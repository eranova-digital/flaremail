import { describe, expect, it } from "vitest";

import { isSystemManagedMailbox } from "../src/lib/system-mailboxes";
import { filterMailboxesForPrincipal } from "../src/services/accounts";
import type { Principal } from "../src/lib/auth/types";

const systemPostmaster = {
	id: "mb-postmaster",
	type: "system",
	localPart: "postmaster",
};
const systemBlackhole = {
	id: "mb-noreply",
	type: "blackhole",
	localPart: "noreply",
};
const userMailbox = {
	id: "mb-user",
	type: "primary",
	localPart: "patrick",
};

function principal(overrides: Partial<Principal>): Principal {
	return {
		kind: "session",
		accountId: "acct-1",
		isIntendant: false,
		role: null,
		status: "active",
		loginIdentifier: "patrick@example.com",
		primaryMailboxId: "mb-user",
		domainIds: [],
		grantMailboxIds: [],
		sharedMailboxAssignment: [],
		...overrides,
	};
}

describe("filterMailboxesForPrincipal", () => {
	it("returns only system mailboxes for the intendant", async () => {
		const rows = [systemPostmaster, systemBlackhole, userMailbox];
		const result = await filterMailboxesForPrincipal(
			{} as never,
			principal({ isIntendant: true, primaryMailboxId: null }),
			rows,
		);

		expect(result).toEqual([systemPostmaster, systemBlackhole]);
		expect(result.every((row) => isSystemManagedMailbox(row))).toBe(true);
	});

	it("filters intendant mailboxes from API DTOs without localPart", async () => {
		const rows = [
			{
				id: "mb-postmaster",
				type: "system",
				isSystemManaged: true,
			},
			{
				id: "mb-abuse",
				type: "alias",
				isSystemManaged: true,
			},
			{
				id: "mb-user",
				type: "primary",
				isSystemManaged: false,
			},
		];
		const result = await filterMailboxesForPrincipal(
			{} as never,
			principal({ isIntendant: true, primaryMailboxId: null }),
			rows,
		);

		expect(result.map((row) => row.id)).toEqual(["mb-postmaster", "mb-abuse"]);
	});

	it("returns all mailboxes for superadmin", async () => {
		const rows = [systemPostmaster, userMailbox];
		const result = await filterMailboxesForPrincipal(
			{} as never,
			principal({ role: "superadmin" }),
			rows,
		);

		expect(result).toEqual(rows);
	});
});
