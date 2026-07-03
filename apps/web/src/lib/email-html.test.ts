import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/attachments", () => ({
	fetchAttachmentBlob: vi.fn(),
}));

import { prepareEmailHtml } from "@/lib/email-html";

describe("prepareEmailHtml", () => {
	it("inlines table, link, and paragraph styles", () => {
		const { html } = prepareEmailHtml(
			'<p>Hello</p><p></p><p><a href="https://example.com">Link</a></p><table><tr><th>H</th><td>C</td></tr></table>',
		);

		expect(html).toContain('style="margin:0 0 1em 0;"');
		expect(html).toContain("&nbsp;");
		expect(html).toContain('style="color:#2563eb;text-decoration:underline;"');
		expect(html).toContain("border-collapse:collapse");
		expect(html).toContain("background-color:#f3f4f6");
	});

	it("converts data url images to cid inline attachments", () => {
		const dataUrl =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
		const { html, inlineAttachments } = prepareEmailHtml(
			`<p><img src="${dataUrl}" width="50%" data-align="center" /></p>`,
		);

		expect(inlineAttachments).toHaveLength(1);
		expect(inlineAttachments[0]?.disposition).toBe("inline");
		expect(inlineAttachments[0]?.mimeType).toBe("image/png");
		expect(html).toMatch(/src="cid:[^"]+"/);
		expect(html).toContain("margin-left:auto;margin-right:auto");
	});
});
