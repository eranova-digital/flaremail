import { describe, expect, it } from "vitest";

import { buildSandboxedHtmlSrcDoc } from "@/components/html/SandboxedHtml";

describe("buildSandboxedHtmlSrcDoc", () => {
	it("marks the body so the iframe can size before resources load", () => {
		const doc = buildSandboxedHtmlSrcDoc("<p>Hello</p>");
		expect(doc).toContain("<body data-flaremail-html>");
		expect(doc).toContain("Hello");
		expect(doc).toContain("height: auto !important");
	});
});
