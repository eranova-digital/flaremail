import { describe, expect, it } from "vitest";

import {
	canAutosaveCompose,
	getSaveBlockedReason,
	hasComposeContent,
	hasComposeRecipient,
	hasComposeSubject,
} from "@/hooks/compose/types";

const emptyFields = {
	to: "",
	cc: "",
	bcc: "",
	subject: "",
	body: "",
	bodyHtml: "<p></p>",
	identityId: null,
};

describe("hasComposeSubject", () => {
	it("returns false when subject is blank", () => {
		expect(hasComposeSubject(emptyFields)).toBe(false);
	});

	it("returns true when subject has text", () => {
		expect(hasComposeSubject({ ...emptyFields, subject: "Hello" })).toBe(true);
	});
});

describe("hasComposeRecipient", () => {
	it("returns false when to is blank", () => {
		expect(hasComposeRecipient(emptyFields)).toBe(false);
	});

	it("returns true when to has an address", () => {
		expect(
			hasComposeRecipient({ ...emptyFields, to: "a@example.com" }),
		).toBe(true);
	});
});

describe("hasComposeContent", () => {
	it("returns false for empty compose state", () => {
		expect(hasComposeContent(emptyFields, [])).toBe(false);
	});

	it("returns true when body has text", () => {
		expect(
			hasComposeContent({ ...emptyFields, body: "hello" }, []),
		).toBe(true);
	});
});

describe("canAutosaveCompose", () => {
	it("returns false without a subject even when body has text", () => {
		expect(
			canAutosaveCompose({ ...emptyFields, body: "hello" }, [], false),
		).toBe(false);
	});

	it("returns false for a new message without a recipient", () => {
		expect(
			canAutosaveCompose(
				{ ...emptyFields, subject: "Hello", body: "world" },
				[],
				false,
			),
		).toBe(false);
	});

	it("returns true for a new message with subject, recipient, and body", () => {
		expect(
			canAutosaveCompose(
				{ ...emptyFields, to: "a@example.com", subject: "Hello", body: "world" },
				[],
				false,
			),
		).toBe(true);
	});

	it("does not require a recipient for replies", () => {
		expect(
			canAutosaveCompose(
				{ ...emptyFields, subject: "Re: Hello", body: "world" },
				[],
				true,
			),
		).toBe(true);
	});
});

describe("getSaveBlockedReason", () => {
	it("returns null when the draft can be saved", () => {
		expect(
			getSaveBlockedReason(
				{
					...emptyFields,
					to: "a@example.com",
					subject: "Hello",
					body: "world",
				},
				[],
				false,
			),
		).toBeNull();
	});

	it("returns a subject error before other validation", () => {
		expect(
			getSaveBlockedReason(
				{ ...emptyFields, to: "a@example.com", body: "world" },
				[],
				false,
			),
		).toBe("Subject is required");
	});
});
