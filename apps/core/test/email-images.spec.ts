import { describe, expect, it } from "vitest";

import { isAllowedRemoteImageUrl } from "../src/lib/email-images/cache-image";
import { processInboundHtmlImages } from "../src/lib/email-images/process-inbound-html";

function createCachedImageBucket(): R2Bucket {
	return {
		head: async () => ({
			size: 128,
			httpMetadata: { contentType: "image/png" },
		}),
		get: async () => null,
		put: async () => undefined,
	} as unknown as R2Bucket;
}

describe("processInboundHtmlImages", () => {
	it("returns html unchanged when no external images are present", async () => {
		const html = '<p>Hello <img src="cid:logo@example.com" /></p>';
		const result = await processInboundHtmlImages(
			html,
			"550e8400-e29b-41d4-a716-446655440000",
			createCachedImageBucket(),
		);

		expect(result.html).toBe(html);
		expect(result.externalImages).toEqual([]);
	});

	it("collects, caches, and rewrites img src, srcset, and css url() values", async () => {
		const messageId = "550e8400-e29b-41d4-a716-446655440000";
		const html = `
			<p style="background-image:url('https://example.com/bg.png')">
				<img src="https://example.com/a.png" srcset="https://example.com/a.png 1x, https://example.com/b.png 2x" />
				<img src="cid:logo@example.com" />
			</p>
		`;

		const result = await processInboundHtmlImages(
			html,
			messageId,
			createCachedImageBucket(),
		);

		expect(result.externalImages).toHaveLength(3);
		expect(result.externalImages.map((image) => image.sourceUrl)).toEqual([
			"https://example.com/a.png",
			"https://example.com/b.png",
			"https://example.com/bg.png",
		]);

		for (const image of result.externalImages) {
			expect(image.messageId).toBe(messageId);
			expect(image.cacheKey).toMatch(/^images\/cache\/[a-f0-9]{64}$/);
			expect(image.id).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
			);
		}

		expect(result.html).toContain(
			`/api/v1/messages/${messageId}/images/${result.externalImages[0]!.id}`,
		);
		expect(result.html).toContain(
			`/api/v1/messages/${messageId}/images/${result.externalImages[1]!.id}`,
		);
		expect(result.html).toContain(
			`/api/v1/messages/${messageId}/images/${result.externalImages[2]!.id}`,
		);
		expect(result.html).not.toContain("https://example.com/a.png");
		expect(result.html).not.toContain("https://example.com/b.png");
		expect(result.html).not.toContain("https://example.com/bg.png");
	});
});

describe("remote image url policy", () => {
	it("blocks private and localhost targets", () => {
		expect(isAllowedRemoteImageUrl("https://example.com/a.png")).toBe(true);
		expect(isAllowedRemoteImageUrl("http://127.0.0.1/a.png")).toBe(false);
		expect(isAllowedRemoteImageUrl("http://localhost/a.png")).toBe(false);
		expect(isAllowedRemoteImageUrl("http://169.254.169.254/latest")).toBe(
			false,
		);
	});
});
