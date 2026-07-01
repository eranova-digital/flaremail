import {
	createExecutionContext,
	env,
	waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker from "../src/index";
import { PROBLEM_CONTENT_TYPE } from "../src/lib/http/problem";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

function authHeaders(token = env.API_BEARER_TOKEN): HeadersInit {
	return {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
	};
}

describe("v1 API auth", () => {
	it("rejects protected routes without authorization", async () => {
		const request = new IncomingRequest("http://example.com/api/v1/messages/send", {
			method: "POST",
			body: JSON.stringify({
				mailboxId: "00000000-0000-0000-0000-000000000001",
				to: ["recipient@example.com"],
				subject: "Hello",
				text: "Body",
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(401);
		expect(response.headers.get("Content-Type")).toContain(PROBLEM_CONTENT_TYPE);
		const body = await response.json();
		expect(body).toMatchObject({
			type: "/api/v1/problems/unauthorized",
			title: "Unauthorized",
			status: 401,
			code: "unauthorized",
		});
		expect(body.detail).toBeTruthy();
	});

	it("rejects protected routes with invalid bearer token", async () => {
		const request = new IncomingRequest("http://example.com/api/v1/messages/send", {
			method: "POST",
			headers: authHeaders("wrong"),
			body: JSON.stringify({
				mailboxId: "00000000-0000-0000-0000-000000000001",
				to: ["recipient@example.com"],
				subject: "Hello",
				text: "Body",
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(401);
	});

	it("validates direct send payload with RFC 9457 problem details", async () => {
		const request = new IncomingRequest("http://example.com/api/v1/messages/send", {
			method: "POST",
			headers: authHeaders(),
			body: JSON.stringify({
				mailboxId: "00000000-0000-0000-0000-000000000001",
				subject: "Missing recipients",
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toContain(PROBLEM_CONTENT_TYPE);
		const body = await response.json();
		expect(body).toMatchObject({
			type: expect.stringContaining("/api/v1/problems/"),
			title: "Bad Request",
			status: 400,
			instance: "/api/v1/messages/send",
		});
		expect(body.detail).toBeTruthy();
	});

	it("requires mailboxId on thread list", async () => {
		const request = new IncomingRequest("http://example.com/api/v1/threads", {
			headers: authHeaders(),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.code).toBe("missing-query-parameter");
	});

	it("requires mailboxId on message preview", async () => {
		const request = new IncomingRequest(
			"http://example.com/api/v1/messages/00000000-0000-0000-0000-000000000001/preview",
			{ headers: authHeaders() },
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.code).toBe("missing-query-parameter");
	});

	it("returns RFC 9457 problem for unknown routes", async () => {
		const request = new IncomingRequest("http://example.com/api/v1/unknown", {
			headers: authHeaders(),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404);
		expect(response.headers.get("Content-Type")).toContain(PROBLEM_CONTENT_TYPE);
	});

	it("serves OpenAPI document without auth", async () => {
		const request = new IncomingRequest("http://example.com/api/v1/openapi.json");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const spec = await response.json();
		expect(spec.openapi).toBe("3.1.0");
		expect(spec.paths["/messages/send"]).toBeDefined();
	});
});
