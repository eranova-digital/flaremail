import { describe, expect, it } from "vitest";

import {
	composeBodyFromMessage,
	composeBodyHasContent,
	isEmptyEditorHtml,
	plainTextToHtml,
} from "./compose-body";

describe("plainTextToHtml", () => {
	it("converts paragraphs and line breaks", () => {
		expect(plainTextToHtml("Hello\n\nWorld")).toBe(
			"<p>Hello</p><p>World</p>",
		);
		expect(plainTextToHtml("Line one\nLine two")).toBe(
			"<p>Line one<br>Line two</p>",
		);
	});

	it("escapes html characters", () => {
		expect(plainTextToHtml("<script>")).toBe("<p>&lt;script&gt;</p>");
	});
});

describe("composeBodyFromMessage", () => {
	it("prefers stored html when present", () => {
		expect(
			composeBodyFromMessage({
				text: "Plain",
				html: "<p><strong>Rich</strong></p>",
			}),
		).toEqual({
			body: "Plain",
			bodyHtml: "<p><strong>Rich</strong></p>",
		});
	});

	it("derives html from plain text when html is missing", () => {
		expect(
			composeBodyFromMessage({
				text: "Hello",
			}),
		).toEqual({
			body: "Hello",
			bodyHtml: "<p>Hello</p>",
		});
	});
});

describe("composeBodyHasContent", () => {
	it("returns false for empty editor state", () => {
		expect(composeBodyHasContent("", "<p></p>")).toBe(false);
	});

	it("returns true when html has content", () => {
		expect(composeBodyHasContent("", "<p>Hello</p>")).toBe(true);
	});
});

describe("isEmptyEditorHtml", () => {
	it("treats blank paragraphs as empty", () => {
		expect(isEmptyEditorHtml("<p></p>")).toBe(true);
		expect(isEmptyEditorHtml("<p><br></p>")).toBe(true);
	});
});
