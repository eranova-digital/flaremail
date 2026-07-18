import { describe, expect, it } from "vitest";

import { htmlFromUploadedText } from "@/components/compose/editor/html-upload";

describe("htmlFromUploadedText", () => {
	it("returns fragments unchanged", () => {
		expect(htmlFromUploadedText("<p>Hi {name}</p>")).toBe("<p>Hi {name}</p>");
	});

	it("extracts body contents and head styles from a full document", () => {
		const file = `<!doctype html>
<html><head><title>x</title><style>.btn{color:red}</style></head>
<body><table><tr><td>Hello {name}</td></tr></table></body></html>`;

		const result = htmlFromUploadedText(file);
		expect(result).toContain("Hello {name}");
		expect(result).toContain("<style>");
		expect(result).toContain(".btn{color:red}");
		expect(result).not.toContain("<html");
		expect(result).not.toContain("<head");
	});

	it("returns empty for blank input", () => {
		expect(htmlFromUploadedText("   ")).toBe("");
	});
});
