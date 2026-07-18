import {
	createExecutionContext,
	env,
	waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker from "../src/index";
import { PROBLEM_CONTENT_TYPE } from "../src/lib/http/problem";

describe("v1 API auth", () => {
	it("rejects protected routes without authorization", async () => {
		const request = new Request("http://example.com/api/v1/messages/send", {
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
		const body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({
			type: "/api/v1/problems/unauthorized",
			title: "Unauthorized",
			status: 401,
			code: "unauthorized",
		});
		expect(body.detail).toBeTruthy();
	});

	it("rejects protected routes with invalid bearer token", async () => {
		const request = new Request("http://example.com/api/v1/messages/send", {
			method: "POST",
			headers: {
				Authorization: "Bearer wrong",
				"Content-Type": "application/json",
			},
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

	it("returns RFC 9457 problem for unknown routes", async () => {
		const request = new Request("http://example.com/api/v1/unknown");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404);
		expect(response.headers.get("Content-Type")).toContain(PROBLEM_CONTENT_TYPE);
	});

	it("serves OpenAPI document without auth", async () => {
		const request = new Request("http://example.com/api/v1/openapi.json");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const spec = (await response.json()) as {
			openapi: unknown;
			paths: Record<string, unknown>;
		};
		expect(spec.openapi).toBe("3.1.0");
		expect(spec.paths["/messages/send"]).toBeDefined();
	});
});
