import { describe, expect, it } from "vitest";

import {
	isBlankSignatureHtml,
	resolveIdentitySignatureHtml,
} from "./apply-signature";
import type { Identity } from "./api";

function identity(overrides: Partial<Identity> = {}): Identity {
	return {
		id: "id-1",
		mailboxId: "mb-1",
		isDefault: false,
		namePattern: "first_name_last_name",
		customName: null,
		signatureHtml: null,
		fromNamePreview: "Pat Borcean",
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

describe("isBlankSignatureHtml", () => {
	it("treats empty and editor-empty html as blank", () => {
		expect(isBlankSignatureHtml(null)).toBe(true);
		expect(isBlankSignatureHtml("")).toBe(true);
		expect(isBlankSignatureHtml("<p></p>")).toBe(true);
		expect(isBlankSignatureHtml("<p><br></p>")).toBe(true);
		expect(isBlankSignatureHtml("<p>&nbsp;</p>")).toBe(true);
	});

	it("keeps real signature content", () => {
		expect(isBlankSignatureHtml("<p>Best,<br>Pat</p>")).toBe(false);
	});
});

describe("resolveIdentitySignatureHtml", () => {
	it("returns null for identities without a signature", () => {
		expect(
			resolveIdentitySignatureHtml({
				identity: identity({ signatureHtml: null }),
				profile: { firstName: "Pat", lastName: "Borcean" },
				mailboxAddress: "pat@example.com",
				primaryAddress: "pat@example.com",
			}),
		).toBeNull();

		expect(
			resolveIdentitySignatureHtml({
				identity: identity({ signatureHtml: "<p></p>" }),
				profile: { firstName: "Pat", lastName: "Borcean" },
				mailboxAddress: "pat@example.com",
				primaryAddress: "pat@example.com",
			}),
		).toBeNull();
	});
});
