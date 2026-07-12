import { and, eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	accountProfiles,
	accounts,
	mailboxGrants,
	mailboxes,
} from "../../db/schema";
import type { Principal } from "../../lib/auth/types";
import { authorizeAccount } from "../../lib/auth/access";
import { isPlatformPrincipal } from "../../lib/auth/principal";
import { MailboxAccessDeniedError } from "../../lib/auth/mailbox-access";
import { assertCanGrantOnSharedMailbox } from "./shared";

export async function grantMailboxAccess(
	db: Database,
	accountId: string,
	mailboxId: string,
) {
	await db.insert(mailboxGrants).values({ accountId, mailboxId });
}

export async function listMailboxGrantHolders(
	db: Database,
	principal: Principal,
	mailboxId: string,
) {
	await assertCanGrantOnSharedMailbox(db, principal, mailboxId);

	const rows = await db
		.select({
			accountId: mailboxGrants.accountId,
			loginIdentifier: accounts.loginIdentifier,
			firstName: accountProfiles.firstName,
			lastName: accountProfiles.lastName,
			role: accounts.role,
			status: accounts.status,
		})
		.from(mailboxGrants)
		.innerJoin(accounts, eq(accounts.id, mailboxGrants.accountId))
		.leftJoin(accountProfiles, eq(accountProfiles.accountId, accounts.id))
		.where(eq(mailboxGrants.mailboxId, mailboxId));

	return rows.map((row) => ({
		accountId: row.accountId,
		loginIdentifier: row.loginIdentifier,
		displayName:
			[row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
			row.loginIdentifier,
		role: row.role,
		status: row.status,
	}));
}

export async function grantSharedMailboxAccess(
	db: Database,
	principal: Principal,
	accountId: string,
	mailboxId: string,
) {
	if (principal.role !== "manager" && principal.role !== "admin" && !isPlatformPrincipal(principal)) {
		throw new MailboxAccessDeniedError();
	}

	await assertCanGrantOnSharedMailbox(db, principal, mailboxId);
	await authorizeAccount(db, principal, accountId, "manage");

	const [target] = await db
		.select({ role: accounts.role })
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!target || target.role !== "user") {
		throw new Error("Shared mailbox access can only be granted to users");
	}

	await grantMailboxAccess(db, accountId, mailboxId);
}

export async function revokeSharedMailboxAccess(
	db: Database,
	principal: Principal,
	accountId: string,
	mailboxId: string,
) {
	if (principal.role !== "manager" && principal.role !== "admin" && !isPlatformPrincipal(principal)) {
		throw new MailboxAccessDeniedError();
	}

	await assertCanGrantOnSharedMailbox(db, principal, mailboxId);
	await authorizeAccount(db, principal, accountId, "manage");

	await db
		.delete(mailboxGrants)
		.where(
			and(
				eq(mailboxGrants.accountId, accountId),
				eq(mailboxGrants.mailboxId, mailboxId),
			),
		);
}
