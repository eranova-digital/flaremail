import { describe, expect, it } from "vitest";

import { extractEmailsFromHeaderValue } from "../src/lib/extract-emails-from-header";

describe("extractEmailsFromHeaderValue", () => {
	it("extracts angle-bracket addresses", () => {
		expect(
			extractEmailsFromHeaderValue(
				'Patrick <patrick@example.com>, Denis <denis@example.com>',
			),
		).toEqual(["patrick@example.com", "denis@example.com"]);
	});

	it("extracts bare addresses", () => {
		expect(extractEmailsFromHeaderValue("paula@example.com")).toEqual([
			"paula@example.com",
		]);
	});

	it("returns empty for nullish values", () => {
		expect(extractEmailsFromHeaderValue(null)).toEqual([]);
		expect(extractEmailsFromHeaderValue("")).toEqual([]);
	});
});
