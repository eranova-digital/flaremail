import { describe, expect, it } from "vitest";

import {
	applyLocalPartPattern,
	assertLocalPartMatchesPolicy,
	isValidMailboxLocalPart,
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
});

describe("assertLocalPartMatchesPolicy", () => {
	it("throws when enforced pattern does not match", () => {
		expect(() =>
			assertLocalPartMatchesPolicy(
				"patrick",
				"{first_name}.{last_name}",
				{ firstName: "Patrick", lastName: "Borcean" },
				true,
			),
		).toThrow(/must match domain policy/);
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
