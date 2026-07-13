import {
	createExecutionContext,
	env,
	waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker from "../src/index";
import { PROBLEM_CONTENT_TYPE } from "../src/lib/http/problem";
import { authHeaders } from "./helpers/auth";

describe("threads API", () => {
	it("rejects thread list without authorization", async () => {
		const request = new Request(
			"http://example.com/api/v1/threads?mailboxId=00000000-0000-0000-0000-000000000001",
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(401);
		expect(response.headers.get("Content-Type")).toContain(PROBLEM_CONTENT_TYPE);
	});

	it("rejects thread list with invalid bearer token", async () => {
		const request = new Request(
			"http://example.com/api/v1/threads?mailboxId=00000000-0000-0000-0000-000000000001",
			{ headers: authHeaders("wrong") },
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(401);
	});
});

describe("outbound-mail service (HTTP)", () => {
	it("validates draft create payload through outbound-mail controller", async () => {
		const request = new Request(
			"http://example.com/api/v1/messages/drafts",
			{
				method: "POST",
				headers: authHeaders(env.API_BEARER_TOKEN),
				body: JSON.stringify({
					mailboxId: "00000000-0000-0000-0000-000000000001",
					subject: "Missing body",
				}),
			},
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toContain(PROBLEM_CONTENT_TYPE);
	});
});
