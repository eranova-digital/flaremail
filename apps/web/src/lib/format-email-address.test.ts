import { describe, expect, it } from "vitest";

import { parseEmailAddressDisplay } from "./format-email-address";

describe("parseEmailAddressDisplay", () => {
	it("returns the full address when no display name is present", () => {
		expect(parseEmailAddressDisplay("patrick@borcean.ro")).toEqual({
			display: "patrick@borcean.ro",
			email: "patrick@borcean.ro",
			hasDisplayName: false,
		});
	});

	it("returns the display name and email for envelope format", () => {
		expect(
			parseEmailAddressDisplay("Patrick <patrick@eranova.ro>"),
		).toEqual({
			display: "Patrick",
			email: "patrick@eranova.ro",
			hasDisplayName: true,
		});
	});

	it("strips quotes from the display name", () => {
		expect(
			parseEmailAddressDisplay('"Patrick Borcean" <patrick@eranova.ro>'),
		).toEqual({
			display: "Patrick Borcean",
			email: "patrick@eranova.ro",
			hasDisplayName: true,
		});
	});
});
