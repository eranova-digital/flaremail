import { describe, expect, it } from "vitest";

import { chooseReassignedOwner } from "../src/services/cascade-delete";

describe("chooseReassignedOwner", () => {
	it("uses the oldest non-alias visible mailbox", () => {
		expect(
			chooseReassignedOwner([
				{
					mailboxId: "shared-newer",
					type: "shared",
					createdAt: new Date("2026-01-03T00:00:00Z"),
				},
				{
					mailboxId: "alias-oldest",
					type: "alias",
					createdAt: new Date("2026-01-01T00:00:00Z"),
				},
				{
					mailboxId: "primary-oldest",
					type: "primary",
					createdAt: new Date("2026-01-02T00:00:00Z"),
				},
			]),
		).toBe("primary-oldest");
	});

	it("returns null when no non-alias visible mailbox remains", () => {
		expect(
			chooseReassignedOwner([
				{
					mailboxId: "alias",
					type: "alias",
					createdAt: new Date("2026-01-01T00:00:00Z"),
				},
			]),
		).toBeNull();
	});
});
