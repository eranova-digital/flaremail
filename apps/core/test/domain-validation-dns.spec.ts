import { describe, expect, it } from "vitest";

import {
	checkDmarcRuaPostmaster,
	checkMxRecordsExist,
} from "../src/lib/domain-validation/dns-checks";
import { dmarcRuaIncludesPostmaster } from "../src/lib/domain-validation/validation-body";

describe("dmarcRuaIncludesPostmaster", () => {
	it("matches mailto postmaster in rua", () => {
		expect(
			dmarcRuaIncludesPostmaster(
				[
					'v=DMARC1; p=none; rua=mailto:dmarc@example.com, mailto:postmaster@example.com',
				],
				"example.com",
			),
		).toBe(true);
	});

	it("rejects missing postmaster rua", () => {
		expect(
			dmarcRuaIncludesPostmaster(
				["v=DMARC1; p=none; rua=mailto:dmarc@example.com"],
				"example.com",
			),
		).toBe(false);
	});
});

describe("checkMxRecordsExist", () => {
	it("fails when no MX answers are returned", async () => {
		const result = await checkMxRecordsExist("example.com", async () => []);
		expect(result.passed).toBe(false);
		expect(result.code).toBe("mx_missing");
	});

	it("passes when MX answers exist", async () => {
		const result = await checkMxRecordsExist(
			"example.com",
			async () => ["10 mx.example.com"],
		);
		expect(result.passed).toBe(true);
	});
});

describe("checkDmarcRuaPostmaster", () => {
	it("fails when DMARC record is missing", async () => {
		const result = await checkDmarcRuaPostmaster("example.com", async () => []);
		expect(result.passed).toBe(false);
		expect(result.code).toBe("dmarc_missing");
	});

	it("passes when rua includes postmaster", async () => {
		const result = await checkDmarcRuaPostmaster(
			"example.com",
			async () => ["v=DMARC1; p=none; rua=mailto:postmaster@example.com"],
		);
		expect(result.passed).toBe(true);
	});
});
