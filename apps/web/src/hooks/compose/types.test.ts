import { describe, expect, it } from "vitest";

import { hasComposeContent } from "@/hooks/compose/types";

describe("hasComposeContent", () => {
	it("returns false for empty compose state", () => {
		expect(
			hasComposeContent(
				{ to: "", cc: "", bcc: "", subject: "", body: "" },
				[],
			),
		).toBe(false);
	});

	it("returns true when body has text", () => {
		expect(
			hasComposeContent(
				{ to: "", cc: "", bcc: "", subject: "", body: "hello" },
				[],
			),
		).toBe(true);
	});
});
