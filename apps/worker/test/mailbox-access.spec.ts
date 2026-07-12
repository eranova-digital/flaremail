import { describe, expect, it } from "vitest";

import { filterMailboxesForPrincipal } from "../src/lib/auth/mailbox-access";
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

describe("filterMailboxesForPrincipal", () => {
	it("returns only system mailboxes for the intendant", async () => {
		const rows = [systemPostmaster, systemPostmasterB, userMailbox, otherUserMailbox];
		const result = await filterMailboxesForPrincipal(
			mockDb([
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
			]),
			principal({ isIntendant: true, primaryMailboxId: null }),
			rows,
			"mail",
		);

		expect(result.map((row) => row.id)).toEqual([
			systemPostmaster.id,
			systemPostmasterB.id,
		]);
	});

	it("returns all instance mailboxes for superadmin", async () => {
		const rows = [systemPostmaster, systemPostmasterB, userMailbox, otherUserMailbox];
		const result = await filterMailboxesForPrincipal(
			mockDb([
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
			]),
			principal({ role: "superadmin", primaryMailboxId: "mb-user" }),
			rows,
			"mail",
		);

		expect(result.map((row) => row.id).sort()).toEqual(
			[
				systemPostmaster.id,
				systemPostmasterB.id,
				userMailbox.id,
				otherUserMailbox.id,
			].sort(),
		);
	});

	it("returns all assigned-domain mailboxes for admin", async () => {
		const rows = [systemPostmaster, systemPostmasterB, userMailbox, otherUserMailbox];
		const result = await filterMailboxesForPrincipal(
			mockDb([
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
			], [domainA]),
			principal({
				role: "admin",
				domainIds: [domainA],
				primaryMailboxId: "mb-user",
			}),
			rows,
			"mail",
		);

		expect(result.map((row) => row.id).sort()).toEqual(
			[systemPostmaster.id, userMailbox.id, otherUserMailbox.id].sort(),
		);
	});

	it("returns all domain mailboxes for manage scope on admin", async () => {
		const rows = [systemPostmaster, userMailbox, otherUserMailbox];
		const result = await filterMailboxesForPrincipal(
			mockDb([
				{
					id: systemPostmaster.id,
					type: systemPostmaster.type,
					localPart: systemPostmaster.localPart!,
					domainId: domainA,
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
			], [domainA]),
			principal({ role: "admin", domainIds: [domainA] }),
			rows,
			"manage",
		);

		expect(result.map((row) => row.id).sort()).toEqual(
			[systemPostmaster.id, userMailbox.id, otherUserMailbox.id].sort(),
		);
	});
});
