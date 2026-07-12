import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	accountDomainAssignments,
	accounts,
	mailboxGrants,
	mailboxes,
	managerSharedMailboxAssignments,
} from "../../db/schema";
import type { Principal } from "../../lib/auth/types";
import { assertCanManageAccount } from "../../lib/auth/account-access";
import { hasDomainAccess, isPlatformPrincipal } from "../../lib/auth/principal";
import { getAccountDetail } from "./profile";
import { grantMailboxAccess } from "./mailbox-grants";
import {
	assertCanGrantOnSharedMailbox,
	assertCanManageMailboxGrants,
	loadDomainAssignments,
} from "./shared";

export async function updateAccountAssignments(
	db: Database,
	principal: Principal,
	accountId: string,
	input: {
		domainIds?: string[];
		allSharedMailboxes?: boolean;
		sharedMailboxIds?: string[];
		grantedMailboxIds?: string[];
	},
) {
	await assertCanManageAccount(db, principal, accountId);

	const [target] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!target) {
		throw new Error("Account not found");
	}
	if (target.isIntendant) {
		throw new Error("Cannot update intendant assignments");
	}

	if (input.grantedMailboxIds !== undefined) {
		if (target.role !== "user") {
			throw new Error("Mailbox grants only apply to user accounts");
		}
		assertCanManageMailboxGrants(principal);
		for (const mailboxId of input.grantedMailboxIds) {
			await assertCanGrantOnSharedMailbox(db, principal, mailboxId);
		}
		await db
			.delete(mailboxGrants)
			.where(eq(mailboxGrants.accountId, accountId));
		for (const mailboxId of input.grantedMailboxIds) {
			await grantMailboxAccess(db, accountId, mailboxId);
		}
		return getAccountDetail(db, principal, accountId);
	}

	if (target.role !== "admin" && target.role !== "manager") {
		throw new Error("Assignments only apply to admin or manager accounts");
	}

	if (input.domainIds !== undefined) {
		for (const domainId of input.domainIds) {
			if (!isPlatformPrincipal(principal) && !hasDomainAccess(principal, domainId)) {
				throw new Error("Forbidden domain assignment");
			}
		}

		await db
			.delete(accountDomainAssignments)
			.where(eq(accountDomainAssignments.accountId, accountId));

		if (input.domainIds.length > 0) {
			await db.insert(accountDomainAssignments).values(
				input.domainIds.map((domainId) => ({
					accountId,
					domainId,
				})),
			);
		}
	}

	if (
		target.role === "manager" &&
		(input.allSharedMailboxes !== undefined || input.sharedMailboxIds !== undefined)
	) {
		const assignmentDomainIds =
			input.domainIds ?? (await loadDomainAssignments(db, accountId));

		await db
			.delete(managerSharedMailboxAssignments)
			.where(eq(managerSharedMailboxAssignments.accountId, accountId));

		if (input.allSharedMailboxes) {
			for (const assignmentDomainId of assignmentDomainIds) {
				await db.insert(managerSharedMailboxAssignments).values({
					accountId,
					domainId: assignmentDomainId,
					mailboxId: null,
					allSharedMailboxes: true,
				});
			}
		} else if (input.sharedMailboxIds?.length) {
			for (const sharedMailboxId of input.sharedMailboxIds) {
				const [sharedMailbox] = await db
					.select({ domainId: mailboxes.domainId, type: mailboxes.type })
					.from(mailboxes)
					.where(eq(mailboxes.id, sharedMailboxId))
					.limit(1);
				if (!sharedMailbox || sharedMailbox.type !== "shared") {
					throw new Error("Invalid shared mailbox assignment");
				}
				if (
					!isPlatformPrincipal(principal) &&
					!hasDomainAccess(principal, sharedMailbox.domainId)
				) {
					throw new Error("Forbidden shared mailbox assignment");
				}
				await db.insert(managerSharedMailboxAssignments).values({
					accountId,
					domainId: sharedMailbox.domainId,
					mailboxId: sharedMailboxId,
					allSharedMailboxes: false,
				});
			}
		}
	}

	return getAccountDetail(db, principal, accountId);
}
