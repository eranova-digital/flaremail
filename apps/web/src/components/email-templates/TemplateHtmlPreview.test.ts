import { describe, expect, it } from "vitest";

import { buildTemplatePreviewSrcDoc } from "@/components/email-templates/TemplateHtmlPreview";

describe("buildTemplatePreviewSrcDoc", () => {
	it("wraps fragments in a standards-mode document", () => {
		const doc = buildTemplatePreviewSrcDoc("<table border='0'><tr><td>Hi</td></tr></table>");
		expect(doc.startsWith("<!DOCTYPE html>")).toBe(true);
		expect(doc).toContain("<body>");
		expect(doc).toContain("Hi");
		expect(doc).toContain('table[role="presentation"]');
		expect(doc).toContain('table[border="0"]');
	});
});
