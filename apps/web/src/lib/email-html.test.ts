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

	it("preserves existing author styles and unwraps compose html wrappers", () => {
		const { html } = prepareEmailHtml(
			`<div data-compose-html="1"><table style="background:#fff;border:0" border="0"><tr><td style="padding:24px"><a href="https://example.com" style="color:#ffffff;background-color:#0867ec;text-decoration:none">CTA</a></td></tr></table></div><p>Outside</p><table><tr><td>TipTap</td></tr></table>`,
		);

		expect(html).not.toContain("data-compose-html");
		expect(html).toContain('style="background:#fff;border:0"');
		expect(html).toContain("color:#ffffff");
		expect(html).toContain("background-color:#0867ec");
		expect(html).toContain("padding:24px");
		expect(html).toContain("border:1px solid #d1d5db");
		expect(html).toContain("TipTap");
		expect(html).toContain('style="margin:0 0 1em 0;"');
		expect(html).toContain("Outside");
	});
});
