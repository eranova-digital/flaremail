import { describe, expect, it } from "vitest";

import {
	buildReplyQuoteHtml,
	buildReplyQuotedText,
	ensureReplyQuoteBody,
	ensureReplyQuoteHtml,
	parseReplyQuoteBlockquote,
} from "./build-reply-quote";

describe("buildReplyQuotedText", () => {
	it("builds a Gmail-style attribution and quotes visible parent text", () => {
		const quoted = buildReplyQuotedText({
			from: "patrick@borcean.ro",
			text: "This is the x email test.",
			sentAt: "2026-07-02T15:14:06.000Z",
		});

		expect(quoted).toMatch(
			/^On Thu, 2 Jul 2026 at \d{2}:\d{2}, <patrick@borcean\.ro> wrote:\n> This is the x email test\.$/,
		);
	});

	it("prefixes every line of the quoted body with '>'", () => {
		const quoted = buildReplyQuotedText({
			from: "alice@example.com",
			text: "Hi Bob,\n\nDo you think you'll have the report ready by tomorrow?\n\nThanks,\nAlice",
			sentAt: "2026-07-03T07:15:00.000Z",
		});

		expect(quoted).toContain(
			"> Hi Bob,\n>\n> Do you think you'll have the report ready by tomorrow?\n>\n> Thanks,\n> Alice",
		);
	});

	it("strips nested quotes from the parent before quoting", () => {
		const quoted = buildReplyQuotedText({
			from: "borceanpatrick2004@gmail.com",
			text: `It works!

On Thu, 2 Jul 2026 at 18:14, <patrick@borcean.ro> wrote:

This is the x email test.`,
			receivedAt: "2026-07-02T15:14:19.000Z",
		});

		expect(quoted).toContain("It works!");
		expect(quoted).not.toContain("This is the x email test.");
	});
});

describe("ensureReplyQuoteBody", () => {
	const quote =
		"On Thu, 2 Jul 2026 at 18:14, <patrick@borcean.ro> wrote:\n> This is the x email test.";

	it("prepends blank lines before the quote for an empty body", () => {
		expect(ensureReplyQuoteBody("", quote)).toBe(`\n\n${quote}`);
	});

	it("does not duplicate an existing quote block", () => {
		const body = `My reply\n\n${quote}`;
		expect(ensureReplyQuoteBody(body, quote)).toBe(body);
	});
});

describe("buildReplyQuoteHtml", () => {
	it("renders a cite blockquote with attribution and quoted paragraphs", () => {
		const html = buildReplyQuoteHtml({
			attribution: "On Thu, 2 Jul 2026 at 18:14, <patrick@borcean.ro> wrote:",
			quotedText: "This is the x email test.",
		});

		expect(html).toBe(
			'<blockquote type="cite" class="quote"><p>On Thu, 2 Jul 2026 at 18:14, &lt;patrick@borcean.ro&gt; wrote:</p><p>This is the x email test.</p></blockquote>',
		);
	});

	it("preserves line breaks inside quoted paragraphs", () => {
		const html = buildReplyQuoteHtml({
			attribution: "On Thu, 2 Jul 2026 at 18:14, <alice@example.com> wrote:",
			quotedText: "Line one\nLine two",
		});

		expect(html).toContain("<p>Line one<br>Line two</p>");
	});
});

describe("ensureReplyQuoteHtml", () => {
	const quote = {
		attribution: "On Thu, 2 Jul 2026 at 18:14, <patrick@borcean.ro> wrote:",
		quotedText: "This is the x email test.",
	};

	it("appends a cite blockquote to an empty editor document", () => {
		expect(ensureReplyQuoteHtml("<p></p>", quote)).toBe(
			`<p></p>${buildReplyQuoteHtml(quote)}`,
		);
	});

	it("does not duplicate an existing cite blockquote", () => {
		const html = `<p>My reply</p>${buildReplyQuoteHtml(quote)}`;
		expect(ensureReplyQuoteHtml(html, quote)).toBe(html);
	});
});

describe("parseReplyQuoteBlockquote", () => {
	it("round-trips attribution and quoted text from blockquote html", () => {
		const html = buildReplyQuoteHtml({
			attribution: "On Thu, 2 Jul 2026 at 18:14, <alice@example.com> wrote:",
			quotedText: "Line one\nLine two",
		});
		const template = document.createElement("template");
		template.innerHTML = html;
		const blockquote = template.content.querySelector("blockquote");

		expect(blockquote).not.toBeNull();
		expect(parseReplyQuoteBlockquote(blockquote as HTMLElement)).toEqual({
			attribution: "On Thu, 2 Jul 2026 at 18:14, <alice@example.com> wrote:",
			quotedText: "Line one\nLine two",
		});
	});
});
