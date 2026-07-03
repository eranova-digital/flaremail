import { describe, expect, it } from "vitest";

import {
	formatAddedCcRecipients,
	formatRecipientList,
	getNewCcRecipients,
	parseAddresses,
} from "./cc-recipients";

describe("parseAddresses", () => {
	it("parses and normalizes a comma-separated list", () => {
		expect(
			parseAddresses('"Denis" <denis@eranova.ro>, ALICE@example.com'),
		).toEqual(["denis@eranova.ro", "alice@example.com"]);
	});

	it("returns an empty list for blank values", () => {
		expect(parseAddresses(null)).toEqual([]);
		expect(parseAddresses("   ")).toEqual([]);
	});
});

describe("getNewCcRecipients", () => {
	it("returns cc recipients not seen earlier in the thread", () => {
		const seen = new Set(["contact@eranova.ro", "borcean@gmail.com"]);
		expect(getNewCcRecipients(seen, "patrick@borcean.ro")).toEqual([
			"patrick@borcean.ro",
		]);
	});

	it("ignores existing participants carried forward by reply all", () => {
		const seen = new Set([
			"contact@eranova.ro",
			"borcean@gmail.com",
			"patrick@borcean.ro",
		]);
		expect(getNewCcRecipients(seen, "contact@eranova.ro")).toEqual([]);
	});

	it("treats display-name formatting as the same address", () => {
		const seen = new Set(["denis@eranova.ro"]);
		expect(
			getNewCcRecipients(seen, '"Denis" <denis@eranova.ro>, alice@example.com'),
		).toEqual(["alice@example.com"]);
	});

	it("de-duplicates repeated additions", () => {
		const seen = new Set<string>();
		expect(
			getNewCcRecipients(seen, "alice@example.com, alice@example.com"),
		).toEqual(["alice@example.com"]);
	});

	it("returns an empty list when cc is empty", () => {
		expect(getNewCcRecipients(new Set(), null)).toEqual([]);
	});
});

describe("formatAddedCcRecipients", () => {
	it("joins multiple recipients with commas", () => {
		expect(
			formatAddedCcRecipients(["denis@eranova.ro", "alice@example.com"]),
		).toBe("denis@eranova.ro, alice@example.com");
	});
});

describe("formatRecipientList", () => {
	it("shows the viewing mailbox as 'me' in the To field", () => {
		expect(
			formatRecipientList(
				"alice@example.com, me@eranova.ro",
				null,
				null,
				"me@eranova.ro",
			),
		).toBe("To: me, alice@example.com");
	});

	it("distinguishes to, cc, and bcc recipients", () => {
		expect(
			formatRecipientList(
				"patrick@eranova.ro",
				"contact@eranova.ro",
				"denis@eranova.ro, paula@borcean.ro",
			),
		).toBe(
			"To: patrick@eranova.ro, CC: contact@eranova.ro, BCC: denis@eranova.ro, paula@borcean.ro",
		);
	});

	it("omits empty recipient fields", () => {
		expect(
			formatRecipientList("alice@example.com", null, null, "me@eranova.ro"),
		).toBe("To: alice@example.com");
	});

	it("returns an empty string when there are no recipients", () => {
		expect(formatRecipientList(null, null, null, "me@eranova.ro")).toBe("");
	});
});
