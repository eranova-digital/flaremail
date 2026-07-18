import { describe, expect, it } from "vitest";

import {
	buildSignatureTagContext,
	joinNameSegments,
	resolveFromName,
	resolveSignatureTags,
} from "../src/lib/identities/name-pattern";

describe("resolveFromName", () => {
	const profile = { firstName: "Patrick", lastName: "Borcean" };

	it("returns empty for none", () => {
		expect(resolveFromName("none", profile)).toBe("");
	});

	it("returns custom name trimmed", () => {
		expect(resolveFromName("custom", profile, "  Acme Sales  ")).toBe(
			"Acme Sales",
		);
	});

	it("resolves profile patterns", () => {
		expect(resolveFromName("first_name", profile)).toBe("Patrick");
		expect(resolveFromName("last_name", profile)).toBe("Borcean");
		expect(resolveFromName("first_name_last_name", profile)).toBe(
			"Patrick Borcean",
		);
		expect(resolveFromName("last_name_first_name", profile)).toBe(
			"Borcean Patrick",
		);
		expect(resolveFromName("first_initial_last_name", profile)).toBe(
			"P Borcean",
		);
		expect(resolveFromName("last_name_first_initial", profile)).toBe(
			"Borcean P",
		);
		expect(resolveFromName("first_name_last_initial", profile)).toBe(
			"Patrick B",
		);
		expect(resolveFromName("last_initial_first_name", profile)).toBe(
			"B Patrick",
		);
	});

	it("omits missing segments", () => {
		expect(
			resolveFromName("first_name_last_name", { firstName: "Patrick" }),
		).toBe("Patrick");
		expect(resolveFromName("first_initial_last_name", { lastName: "Borcean" })).toBe(
			"Borcean",
		);
		expect(joinNameSegments("", "  ", "X")).toBe("X");
	});
});

describe("resolveSignatureTags", () => {
	it("substitutes known tags and leaves unknown literal", () => {
		const context = buildSignatureTagContext({
			fromName: "P Borcean",
			profile: { firstName: "Patrick", lastName: "Borcean" },
			mailboxAddress: "sales@acme.com",
			primaryAddress: "patrick@acme.com",
		});

		expect(
			resolveSignatureTags(
				"— {from_name} @ Acme · {mailbox_address} · {primary_address} · {display_name}",
				context,
			),
		).toBe(
			"— P Borcean @ Acme · sales@acme.com · patrick@acme.com · {display_name}",
		);
	});
});
