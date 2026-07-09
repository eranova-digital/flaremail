import { describe, expect, it } from "vitest";

import {
	assertMailboxMutable,
	isSystemManagedLocalPart,
	isSystemManagedMailbox,
} from "../src/lib/system-mailboxes";

describe("isSystemManagedLocalPart", () => {
	it("recognizes reserved local parts", () => {
		expect(isSystemManagedLocalPart("postmaster")).toBe(true);
		expect(isSystemManagedLocalPart("abuse")).toBe(true);
		expect(isSystemManagedLocalPart("noreply")).toBe(true);
		expect(isSystemManagedLocalPart("Postmaster")).toBe(true);
	});

	it("rejects normal local parts", () => {
		expect(isSystemManagedLocalPart("patrick")).toBe(false);
		expect(isSystemManagedLocalPart("support")).toBe(false);
	});
});

describe("isSystemManagedMailbox", () => {
	it("treats system type mailboxes as managed", () => {
		expect(
			isSystemManagedMailbox({ type: "system", localPart: "postmaster" }),
		).toBe(true);
	});

	it("treats reserved alias local parts as managed", () => {
		expect(isSystemManagedMailbox({ type: "alias", localPart: "abuse" })).toBe(
			true,
		);
	});

	it("treats blackhole noreply mailboxes as managed", () => {
		expect(
			isSystemManagedMailbox({ type: "blackhole", localPart: "noreply" }),
		).toBe(true);
	});

	it("allows normal mailboxes", () => {
		expect(
			isSystemManagedMailbox({ type: "primary", localPart: "patrick" }),
		).toBe(false);
	});
});

describe("assertMailboxMutable", () => {
	it("rejects system managed mailboxes", () => {
		expect(() =>
			assertMailboxMutable({ type: "system", localPart: "postmaster" }),
		).toThrow("System mailboxes cannot be modified or deleted");
	});

	it("allows normal mailboxes", () => {
		expect(() =>
			assertMailboxMutable({ type: "primary", localPart: "patrick" }),
		).not.toThrow();
	});
});
