import { describe, expect, it } from "vitest";

import { htmlFromUploadedText } from "../src/lib/email-templates/html-from-upload";

describe("htmlFromUploadedText", () => {
	it("returns fragments unchanged", () => {
		expect(htmlFromUploadedText("<p>Hi</p>")).toBe("<p>Hi</p>");
	});

	it("extracts body and head styles from full documents", () => {
		const result = htmlFromUploadedText(`<!DOCTYPE html>
<html>
<head><style>.x{color:red}</style></head>
<body><p>Hello</p></body>
</html>`);

		expect(result).toContain("<style>.x{color:red}</style>");
		expect(result).toContain("<p>Hello</p>");
		expect(result).not.toContain("<html");
		expect(result).not.toContain("<body");
	});
});
