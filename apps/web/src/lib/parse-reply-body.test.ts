import { describe, expect, it } from "vitest";

import {
	getPlainTextSource,
	htmlToPlainText,
	parseReplyBody,
	splitQuotedHtml,
} from "./parse-reply-body";

describe("parseReplyBody", () => {
	it("keeps visible text and detects Gmail-style quoted replies", () => {
		const body = `It works!

On Thu, 2 Jul 2026 at 18:14, <patrick@borcean.ro> wrote:

This is the x email test.`;

		const result = parseReplyBody(body);
		expect(result.visibleText).toBe("It works!\n");
		expect(result.hasQuotedReply).toBe(true);
		expect(result.quotedText).toContain("This is the x email test.");
	});

	it("returns no quoted reply for a plain message", () => {
		const body = "This is the x email test.";

		const result = parseReplyBody(body);
		expect(result.visibleText).toBe("This is the x email test.");
		expect(result.hasQuotedReply).toBe(false);
		expect(result.quotedText).toBe("");
	});
});

describe("getPlainTextSource", () => {
	it("prefers text over html and preview", () => {
		expect(
			getPlainTextSource("plain text", "<p>html</p>", "preview"),
		).toBe("plain text");
	});

	it("falls back to html-derived text", () => {
		expect(getPlainTextSource(null, "<p>Hello <strong>world</strong></p>", null)).toBe(
			"Hello world",
		);
	});
});

describe("htmlToPlainText", () => {
	it("strips html tags", () => {
		expect(htmlToPlainText("<div>Line one<br>Line two</div>")).toBe(
			"Line oneLine two",
		);
	});
});

describe("splitQuotedHtml", () => {
	it("keeps signature html in the visible part of a Flaremail reply", () => {
		const html = [
			"<p>Thanks for the update.</p>",
			'<div data-flaremail-signature="1"><hr><p><strong>Sales</strong></p></div>',
			'<blockquote type="cite" class="quote gmail_quote"><p>On Mon, someone wrote:</p><p>Hello</p></blockquote>',
		].join("");

		const result = splitQuotedHtml(html);
		expect(result.visibleHtml).toContain("Thanks for the update");
		expect(result.visibleHtml).toContain("data-flaremail-signature");
		expect(result.visibleHtml).toContain("<hr>");
		expect(result.visibleHtml).toContain("<strong>Sales</strong>");
		expect(result.visibleHtml).not.toContain("blockquote");
		expect(result.quotedHtml).toContain("Hello");
	});

	it("splits Gmail-style quote wrappers", () => {
		const html =
			'<div>Got it</div><div class="gmail_quote"><div class="gmail_attr">On Mon wrote:</div><blockquote>Prior</blockquote></div>';
		const result = splitQuotedHtml(html);
		expect(result.visibleHtml).toContain("Got it");
		expect(result.visibleHtml).not.toContain("gmail_quote");
		expect(result.quotedHtml).toContain("Prior");
	});

	it("returns the full html when there is no quote marker", () => {
		const html = "<p>Just a note</p><hr><p>Pat</p>";
		expect(splitQuotedHtml(html)).toEqual({
			visibleHtml: html,
			quotedHtml: null,
		});
	});
});
