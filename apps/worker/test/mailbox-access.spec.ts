import { describe, expect, it } from "vitest";

import { filterMailboxesForPrincipal } from "../src/lib/auth/access";
import type { Principal } from "../src/lib/auth/types";

const domainA = "domain-a";
const domainB = "domain-b";

const systemPostmaster = {
	id: "mb-postmaster-a",
	type: "system",
	localPart: "postmaster",
	domainId: domainA,
	isSystemManaged: true,
};
const systemPostmasterB = {
	id: "mb-postmaster-b",
	type: "system",
	localPart: "postmaster",
	domainId: domainB,
	isSystemManaged: true,
};
const userMailbox = {
	id: "mb-user",
	type: "primary",
	localPart: "patrick",
	domainId: domainA,
	isSystemManaged: false,
};
const otherUserMailbox = {
	id: "mb-other",
	type: "primary",
	localPart: "jane",
	domainId: domainA,
	isSystemManaged: false,
};
const sharedMailbox = {
	id: "mb-shared",
	type: "shared",
	localPart: "sales",
	domainId: domainA,
	isSystemManaged: false,
};
const sharedMailboxB = {
	id: "mb-shared-b",
	type: "shared",
	localPart: "support",
	domainId: domainB,
	isSystemManaged: false,
};

function mockDb(
	rows: Array<{
		id: string;
		type: string;
		localPart: string;
		domainId: string;
	}>,
	whereDomainIds?: string[],
) {
	return {
		select: () => ({
			from: () => {
				const result = Promise.resolve(rows);
				return Object.assign(result, {
					where: () => {
						const matched =
							whereDomainIds && whereDomainIds.length > 0
								? rows.filter((row) =>
										whereDomainIds.includes(row.domainId),
									)
								: rows;
						return Promise.resolve(matched.map((row) => ({ id: row.id })));
					},
				});
			},
		}),
	} as never;
}

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

const allMailboxRows = [
	{
		id: systemPostmaster.id,
		type: systemPostmaster.type,
		localPart: systemPostmaster.localPart!,
		domainId: domainA,
	},
	{
		id: systemPostmasterB.id,
		type: systemPostmasterB.type,
		localPart: systemPostmasterB.localPart!,
		domainId: domainB,
	},
	{
		id: userMailbox.id,
		type: userMailbox.type,
		localPart: userMailbox.localPart!,
		domainId: domainA,
	},
	{
		id: otherUserMailbox.id,
		type: otherUserMailbox.type,
		localPart: otherUserMailbox.localPart!,
		domainId: domainA,
	},
	{
		id: sharedMailbox.id,
		type: sharedMailbox.type,
		localPart: sharedMailbox.localPart!,
		domainId: domainA,
	},
	{
		id: sharedMailboxB.id,
		type: sharedMailboxB.type,
		localPart: sharedMailboxB.localPart!,
		domainId: domainB,
	},
];

describe("filterMailboxesForPrincipal", () => {
	it("returns system and shared mailboxes for the intendant", async () => {
		const rows = [
			systemPostmaster,
			systemPostmasterB,
			userMailbox,
			otherUserMailbox,
			sharedMailbox,
			sharedMailboxB,
		];
		const result = await filterMailboxesForPrincipal(
			mockDb(allMailboxRows),
			principal({ isIntendant: true, primaryMailboxId: null }),
			rows,
			"mail",
		);

		expect(result.map((row) => row.id).sort()).toEqual(
			[
				systemPostmaster.id,
				systemPostmasterB.id,
				sharedMailbox.id,
				sharedMailboxB.id,
			].sort(),
		);
	});

	it("returns primary, system, and all shared mailboxes for superadmin", async () => {
		const rows = [
			systemPostmaster,
			systemPostmasterB,
			userMailbox,
			otherUserMailbox,
			sharedMailbox,
			sharedMailboxB,
		];
		const result = await filterMailboxesForPrincipal(
			mockDb(allMailboxRows),
			principal({
				role: "superadmin",
				primaryMailboxId: "mb-user",
			}),
			rows,
			"mail",
		);

		expect(result.map((row) => row.id).sort()).toEqual(
			[userMailbox.id, systemPostmaster.id, systemPostmasterB.id, sharedMailbox.id, sharedMailboxB.id].sort(),
		);
	});

	it("returns primary, domain system, and domain shared mailboxes for admin", async () => {
		const rows = [
			systemPostmaster,
			systemPostmasterB,
			userMailbox,
			otherUserMailbox,
			sharedMailbox,
			sharedMailboxB,
		];
		const result = await filterMailboxesForPrincipal(
			mockDb(allMailboxRows, [domainA]),
			principal({
				role: "admin",
				domainIds: [domainA],
				primaryMailboxId: "mb-user",
			}),
			rows,
			"mail",
		);

		expect(result.map((row) => row.id).sort()).toEqual(
			[userMailbox.id, systemPostmaster.id, sharedMailbox.id].sort(),
		);
	});

	it("returns primary and assigned shared mailboxes for manager", async () => {
		const rows = [userMailbox, otherUserMailbox, sharedMailbox, sharedMailboxB];
		const result = await filterMailboxesForPrincipal(
			mockDb(allMailboxRows),
			principal({
				role: "manager",
				primaryMailboxId: "mb-other",
				sharedMailboxAssignment: [
					{
						domainId: domainA,
						mailboxId: sharedMailbox.id,
						allSharedMailboxes: false,
					},
				],
			}),
			rows,
			"mail",
		);

		expect(result.map((row) => row.id).sort()).toEqual(
			[otherUserMailbox.id, sharedMailbox.id].sort(),
		);
	});

	it("returns primary and granted shared mailboxes for user", async () => {
		const rows = [userMailbox, otherUserMailbox, sharedMailbox, sharedMailboxB];
		const result = await filterMailboxesForPrincipal(
			mockDb(allMailboxRows),
			principal({
				role: "user",
				primaryMailboxId: "mb-user",
				grantMailboxIds: [sharedMailbox.id],
			}),
			rows,
			"mail",
		);

		expect(result.map((row) => row.id).sort()).toEqual(
			[userMailbox.id, sharedMailbox.id].sort(),
		);
	});

	it("returns all domain mailboxes for manage scope on admin", async () => {
		const rows = [systemPostmaster, userMailbox, otherUserMailbox];
		const result = await filterMailboxesForPrincipal(
			mockDb(allMailboxRows, [domainA]),
			principal({ role: "admin", domainIds: [domainA] }),
			rows,
			"manage",
		);

		expect(result.map((row) => row.id).sort()).toEqual(
			[systemPostmaster.id, userMailbox.id, otherUserMailbox.id].sort(),
		);
	});
});
