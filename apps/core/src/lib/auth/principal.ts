import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	accountDomainAssignments,
	accountProfiles,
	accounts,
	mailboxGrants,
	managerSharedMailboxAssignments,
} from "../../db/schema";
import type { Principal } from "./types";

export async function loadPrincipalForAccount(
	db: Database,
	accountId: string,
	kind: Principal["kind"],
	extra?: Partial<Principal>,
): Promise<Principal | null> {
	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);

	if (!account) {
		return null;
	}

	const domainRows = await db
		.select({ domainId: accountDomainAssignments.domainId })
		.from(accountDomainAssignments)
		.where(eq(accountDomainAssignments.accountId, accountId));

	const grantRows = await db
		.select({ mailboxId: mailboxGrants.mailboxId })
		.from(mailboxGrants)
		.where(eq(mailboxGrants.accountId, accountId));

	const sharedRows = await db
		.select()
		.from(managerSharedMailboxAssignments)
		.where(eq(managerSharedMailboxAssignments.accountId, accountId));

	return {
		kind,
		accountId: account.id,
		isIntendant: account.isIntendant,
		role: account.role,
		status: account.status,
		loginIdentifier: account.loginIdentifier,
		primaryMailboxId: account.primaryMailboxId,
		domainIds: domainRows.map((row) => row.domainId),
		grantMailboxIds: grantRows.map((row) => row.mailboxId),
		sharedMailboxAssignment: sharedRows.map((row) => ({
			domainId: row.domainId,
			mailboxId: row.mailboxId,
			allSharedMailboxes: row.allSharedMailboxes,
		})),
		...extra,
	};
}

export async function loadAccountProfile(db: Database, accountId: string) {
	const [profile] = await db
		.select()
		.from(accountProfiles)
		.where(eq(accountProfiles.accountId, accountId))
		.limit(1);
	return profile ?? null;
}

export function accessibleMailboxIds(principal: Principal): Set<string> {
	const ids = new Set<string>();
	if (principal.primaryMailboxId) {
		ids.add(principal.primaryMailboxId);
	}
	for (const mailboxId of principal.grantMailboxIds) {
		ids.add(mailboxId);
	}
	return ids;
}

export function isPlatformPrincipal(principal: Principal): boolean {
	return principal.isIntendant || principal.role === "superadmin";
}

export function hasDomainAccess(principal: Principal, domainId: string): boolean {
	if (isPlatformPrincipal(principal)) {
		return true;
	}
	return principal.domainIds.includes(domainId);
}
