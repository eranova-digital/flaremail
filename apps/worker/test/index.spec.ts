import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("email catch-all worker", () => {
	it("returns health check (unit style)", async () => {
		const request = new IncomingRequest("http://example.com/health");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(await response.json()).toEqual({ ok: true });
	});

	it("returns health check (integration style)", async () => {
		const response = await SELF.fetch("https://example.com/health");
		expect(await response.json()).toEqual({ ok: true });
	});
});
