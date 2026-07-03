import { describe, expect, it } from "vitest";

import { prepareEmailHtml } from "../src/lib/messages/prepare-email-html";

describe("prepareEmailHtml", () => {
	it("inlines table, link, and paragraph styles", async () => {
		const { html } = await prepareEmailHtml(
			'<p>Hello</p><p></p><p><a href="https://example.com">Link</a></p><table><tr><th>H</th><td>C</td></tr></table>',
		);

		expect(html).toContain('style="margin:0 0 1em 0;"');
		expect(html).toContain("&nbsp;");
		expect(html).toContain('style="color:#2563eb;text-decoration:underline;"');
		expect(html).toContain("border-collapse:collapse");
		expect(html).toContain("background-color:#f3f4f6");
	});

	it("inlines quote styling and tags cite blockquotes as gmail quotes", async () => {
		const { html } = await prepareEmailHtml(
			'<p>Reply</p><blockquote type="cite" class="quote"><p>On date, someone wrote:</p><p>Original</p></blockquote>',
		);

		expect(html).toContain("border-left:1px solid #ccc");
		expect(html).toContain("padding-left:1ex");
		expect(html).toContain("gmail_quote");
	});

	it("styles plain blockquotes without adding the gmail quote class", async () => {
		const { html } = await prepareEmailHtml(
			"<blockquote><p>Just a quote</p></blockquote>",
		);

		expect(html).toContain("border-left:1px solid #ccc");
		expect(html).not.toContain("gmail_quote");
	});

	it("converts data url images to cid inline attachments", async () => {
		const dataUrl =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
		const { html, inlineAttachments } = await prepareEmailHtml(
			`<p><img src="${dataUrl}" width="50%" data-align="center" /></p>`,
		);

		expect(inlineAttachments).toHaveLength(1);
		expect(inlineAttachments[0]?.disposition).toBe("inline");
		expect(inlineAttachments[0]?.mimeType).toBe("image/png");
		expect(html).toMatch(/src="cid:[^"]+"/);
		expect(html).toContain("margin-left:auto;margin-right:auto");
	});
});
