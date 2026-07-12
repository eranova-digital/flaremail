import { describe, expect, it } from "vitest";

import {
	applyLocalPartPattern,
	generatePatternRandomValues,
	getProfileFieldsUsedByPattern,
	isValidMailboxLocalPart,
	resolveLocalPartForInvite,
} from "../src/lib/local-part-policy";

describe("applyLocalPartPattern", () => {
	it("renders first and last name tokens", () => {
		expect(
			applyLocalPartPattern("{first_name}.{last_name}", {
				firstName: "Patrick",
				lastName: "Borcean",
			}),
		).toBe("patrick.borcean");
	});

	it("renders last name initial token", () => {
		expect(
			applyLocalPartPattern("{first_name}.{last_name_initial}", {
				firstName: "Patrick",
				lastName: "Borcean",
			}),
		).toBe("patrick.b");
	});

	it("renders random tokens", () => {
		const random = { rndNum: "1234", rndChar: "x" };
		expect(
			applyLocalPartPattern("{first_name}.{rnd_num}.{rnd_char}", {
				firstName: "Patrick",
			}, random),
		).toBe("patrick.1234.x");
	});
});

describe("getProfileFieldsUsedByPattern", () => {
	it("returns fields referenced by the pattern", () => {
		expect(
			getProfileFieldsUsedByPattern("{first_name}.{last_name_initial}"),
		).toEqual(["firstName", "lastName"]);
	});

	it("returns only first name when pattern uses first name only", () => {
		expect(getProfileFieldsUsedByPattern("{first_name}")).toEqual(["firstName"]);
	});
});

describe("resolveLocalPartForInvite", () => {
	it("enforces policy only for manager inviters", () => {
		const result = resolveLocalPartForInvite({
			pattern: "{first_name}.{last_name}",
			enforced: true,
			inviterIsManager: true,
			profile: { firstName: "Patrick", lastName: "Borcean" },
			requestedLocalPart: "custom",
		});
		expect(result.localPart).toBe("patrick.borcean");
	});

	it("allows custom local part for non-manager inviters", () => {
		const result = resolveLocalPartForInvite({
			pattern: "{first_name}.{last_name}",
			enforced: true,
			inviterIsManager: false,
			profile: { firstName: "Patrick", lastName: "Borcean" },
			requestedLocalPart: "custom.name",
		});
		expect(result.localPart).toBe("custom.name");
	});
});

describe("isValidMailboxLocalPart", () => {
	it("accepts normal local parts", () => {
		expect(isValidMailboxLocalPart("patrick.borcean")).toBe(true);
	});

	it("rejects invalid local parts", () => {
		expect(isValidMailboxLocalPart(".patrick")).toBe(false);
	});
});

describe("generatePatternRandomValues", () => {
	it("returns stable-shaped random values", () => {
		const random = generatePatternRandomValues();
		expect(random.rndNum).toMatch(/^\d{4}$/);
		expect(random.rndChar).toMatch(/^[a-z]$/);
	});
});
