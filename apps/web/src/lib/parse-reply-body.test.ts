import { describe, expect, it } from "vitest";

import {
	getPlainTextSource,
	htmlToPlainText,
	parseReplyBody,
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
