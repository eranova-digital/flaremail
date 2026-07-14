import { describe, expect, it } from "vitest";

import { imageCacheKeyForUrl } from "../src/lib/email-images/cache-key";
import { extractExternalImageUrls } from "../src/lib/email-images/extract-urls";
import { hashImageUrl } from "../src/lib/email-images/hash-url";
import { messageExternalImageProxyPath } from "../src/lib/email-images/proxy-path";
import { rewriteExternalImageUrls } from "../src/lib/email-images/rewrite-html";
import {
	isAllowedRemoteImageUrl,
	isExternalImageUrl,
	normalizeImageUrl,
	parseSrcsetUrls,
	rewriteSrcset,
} from "../src/lib/email-images/url";

describe("email image url helpers", () => {
	it("normalizes external http(s) image urls", () => {
		expect(normalizeImageUrl("https://example.com/pixel.gif?x=1#hash")).toBe(
			"https://example.com/pixel.gif?x=1",
		);
		expect(isExternalImageUrl("https://example.com/a.png")).toBe(true);
		expect(isExternalImageUrl("cid:logo@example.com")).toBe(false);
		expect(isExternalImageUrl("data:image/png;base64,abc")).toBe(false);
	});

	it("blocks private and localhost targets", () => {
		expect(isAllowedRemoteImageUrl("https://example.com/a.png")).toBe(true);
		expect(isAllowedRemoteImageUrl("http://127.0.0.1/a.png")).toBe(false);
		expect(isAllowedRemoteImageUrl("http://localhost/a.png")).toBe(false);
		expect(isAllowedRemoteImageUrl("http://169.254.169.254/latest")).toBe(
			false,
		);
	});

	it("hashes urls deterministically", async () => {
		const hash = await hashImageUrl("https://example.com/a.png");
		expect(hash).toHaveLength(64);
		expect(await hashImageUrl("https://example.com/a.png")).toBe(hash);
	});

	it("builds cache keys and proxy paths", async () => {
		expect(await imageCacheKeyForUrl("https://example.com/a.png")).toMatch(
			/^images\/cache\/[a-f0-9]{64}$/,
		);
		expect(
			messageExternalImageProxyPath(
				"550e8400-e29b-41d4-a716-446655440000",
				"660e8400-e29b-41d4-a716-446655440001",
			),
		).toBe(
			"/api/v1/messages/550e8400-e29b-41d4-a716-446655440000/images/660e8400-e29b-41d4-a716-446655440001",
		);
	});

	it("parses and rewrites srcset entries", () => {
		expect(parseSrcsetUrls("https://a.test/1.png 1x, https://a.test/2.png 2x")).toEqual([
			"https://a.test/1.png",
			"https://a.test/2.png",
		]);

		expect(
			rewriteSrcset("https://a.test/1.png 1x, https://a.test/2.png 2x", (url) =>
				url.includes("1.png") ? "/proxy/1.png" : null,
			),
		).toBe("/proxy/1.png 1x, https://a.test/2.png 2x");
	});
});

describe("extractExternalImageUrls", () => {
	it("collects img src, srcset, and css url() values", () => {
		const html = `
			<p style="background-image:url('https://example.com/bg.png')">
				<img src="https://example.com/a.png" srcset="https://example.com/a.png 1x, https://example.com/b.png 2x" />
				<img src="cid:logo@example.com" />
			</p>
		`;

		expect(extractExternalImageUrls(html)).toEqual([
			"https://example.com/a.png",
			"https://example.com/b.png",
			"https://example.com/bg.png",
		]);
	});
});

describe("rewriteExternalImageUrls", () => {
	it("rewrites img and css image urls to proxy paths", async () => {
		const html =
			'<div style="background-image:url(https://example.com/bg.png)"><img src="https://example.com/a.png" srcset="https://example.com/a.png 1x, https://example.com/b.png 2x" /></div>';

		const rewritten = await rewriteExternalImageUrls(html, [
			{
				sourceUrl: "https://example.com/a.png",
				proxyPath: "/api/v1/messages/msg/images/a",
			},
			{
				sourceUrl: "https://example.com/b.png",
				proxyPath: "/api/v1/messages/msg/images/b",
			},
			{
				sourceUrl: "https://example.com/bg.png",
				proxyPath: "/api/v1/messages/msg/images/bg",
			},
		]);

		expect(rewritten).toContain('src="/api/v1/messages/msg/images/a"');
		expect(rewritten).toContain(
			'srcset="/api/v1/messages/msg/images/a 1x, /api/v1/messages/msg/images/b 2x"',
		);
		expect(rewritten).toContain(
			"background-image:url(/api/v1/messages/msg/images/bg)",
		);
	});
});
