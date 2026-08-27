import {
	createExecutionContext,
	env,
	waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker from "../src/index";
import { PROBLEM_CONTENT_TYPE } from "../src/lib/http/problem";
import { v1Routes } from "../src/routes/v1";

describe("drafts list API", () => {
	it("declares drafts:list on GET /messages/drafts", () => {
		const route = v1Routes.find(
			(entry) =>
				entry.method === "GET" && entry.path === "/api/v1/messages/drafts",
		);
		expect(route?.scopes).toEqual(["drafts:list"]);
		expect(route?.action).toBe("mail_read");
	});

	it("rejects draft list without authorization", async () => {
		const request = new Request(
			"http://example.com/api/v1/messages/drafts?mailboxId=00000000-0000-0000-0000-000000000001",
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(401);
		expect(response.headers.get("Content-Type")).toContain(PROBLEM_CONTENT_TYPE);
	});

	it("rejects draft list with invalid bearer token", async () => {
		const request = new Request(
			"http://example.com/api/v1/messages/drafts?mailboxId=00000000-0000-0000-0000-000000000001",
			{
				headers: {
					Authorization: "Bearer wrong",
					"Content-Type": "application/json",
				},
			},
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(401);
	});
});
