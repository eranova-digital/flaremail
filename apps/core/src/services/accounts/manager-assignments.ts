import { and, eq, ne } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	accountProfiles,
	accounts,
	mailboxes,
	managerSharedMailboxAssignments,
} from "../../db/schema";
import type { AccountRole, Principal } from "../../lib/auth/types";
import { authorizeAccount } from "../../lib/auth/access";
import type { LogContext } from "../../lib/logs/context";
import { safeEmitLog } from "../../lib/logs/emit";
import { toProfilePicturePayload } from "../../lib/profile-picture/payload";
import {
	assertCanGrantOnSharedMailbox,
	assertCanManageManagerAssignments,
	loadManagerSharedMailboxAssignments,
} from "./shared";

export async function listMailboxManagerAssignments(
	db: Database,
	principal: Principal,
	mailboxId: string,
) {
	await assertCanGrantOnSharedMailbox(db, principal, mailboxId);
	assertCanManageManagerAssignments(principal);

	const [mailbox] = await db
		.select({ domainId: mailboxes.domainId, type: mailboxes.type })
		.from(mailboxes)
		.where(eq(mailboxes.id, mailboxId))
		.limit(1);
	if (!mailbox || mailbox.type !== "shared") {
		throw new Error("Only shared mailboxes support manager assignments");
	}

	const rows = await db
		.select({
			accountId: managerSharedMailboxAssignments.accountId,
			mailboxId: managerSharedMailboxAssignments.mailboxId,
			allSharedMailboxes: managerSharedMailboxAssignments.allSharedMailboxes,
			domainId: managerSharedMailboxAssignments.domainId,
			loginIdentifier: accounts.loginIdentifier,
			firstName: accountProfiles.firstName,
			lastName: accountProfiles.lastName,
			profilePictureUpdatedAt: accountProfiles.profilePictureUpdatedAt,
			role: accounts.role,
			status: accounts.status,
		})
		.from(managerSharedMailboxAssignments)
		.innerJoin(
			accounts,
			eq(accounts.id, managerSharedMailboxAssignments.accountId),
		)
		.leftJoin(accountProfiles, eq(accountProfiles.accountId, accounts.id))
		.where(
			and(
				eq(accounts.role, "manager"),
				eq(accounts.status, "active"),
			),
		);

	const holders = new Map<
		string,
		{
			accountId: string;
			loginIdentifier: string;
			displayName: string;
			profilePicture: ReturnType<typeof toProfilePicturePayload>;
			role: AccountRole;
			status: string;
			viaAllShared: boolean;
		}
	>();

	for (const row of rows) {
		const coversMailbox =
			row.mailboxId === mailboxId ||
			(row.allSharedMailboxes && row.domainId === mailbox.domainId);
		if (!coversMailbox) {
			continue;
		}

		const existing = holders.get(row.accountId);
		const viaAllShared = row.allSharedMailboxes;
		if (existing) {
			holders.set(row.accountId, {
				...existing,
				viaAllShared: existing.viaAllShared || viaAllShared,
			});
			continue;
		}

		holders.set(row.accountId, {
			accountId: row.accountId,
			loginIdentifier: row.loginIdentifier,
			displayName:
				[row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
				row.loginIdentifier,
			profilePicture: toProfilePicturePayload(row.profilePictureUpdatedAt),
			role: row.role as AccountRole,
			status: row.status,
			viaAllShared,
		});
	}

	return [...holders.values()].sort((left, right) =>
		left.displayName.localeCompare(right.displayName),
	);
}

export async function grantManagerMailboxAssignment(
	db: Database,
	principal: Principal,
	accountId: string,
	mailboxId: string,
	logContext?: LogContext | null,
) {
	assertCanManageManagerAssignments(principal);
	await assertCanGrantOnSharedMailbox(db, principal, mailboxId);
	await authorizeAccount(db, principal, accountId, "manage");

	const [target] = await db
		.select({ role: accounts.role })
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!target || target.role !== "manager") {
		throw new Error("Manager assignments only apply to manager accounts");
	}

	const [mailbox] = await db
		.select({ domainId: mailboxes.domainId, type: mailboxes.type })
		.from(mailboxes)
		.where(eq(mailboxes.id, mailboxId))
		.limit(1);
	if (!mailbox || mailbox.type !== "shared") {
		throw new Error("Only shared mailboxes support manager assignments");
	}

	const assignments = await loadManagerSharedMailboxAssignments(db, accountId);
	if (
		assignments.some(
			(assignment) =>
				assignment.allSharedMailboxes &&
				assignment.domainId === mailbox.domainId,
		)
	) {
		return;
	}
	if (assignments.some((assignment) => assignment.mailboxId === mailboxId)) {
		return;
	}

	await db.insert(managerSharedMailboxAssignments).values({
		accountId,
		domainId: mailbox.domainId,
		mailboxId,
		allSharedMailboxes: false,
	});

	if (principal.accountId) {
		await safeEmitLog(db, {
			importance: 5,
			type: "mailboxes",
			summary: "{actor} assigned {account} to manage {mailbox}",
			refs: {
				actor: { kind: "account", id: principal.accountId },
				account: { kind: "account", id: accountId },
				mailbox: { kind: "mailbox", id: mailboxId },
			},
			actorAccountId: principal.accountId,
			context: logContext,
		});
	}
}

export async function revokeManagerMailboxAssignment(
	db: Database,
	principal: Principal,
	accountId: string,
	mailboxId: string,
	logContext?: LogContext | null,
) {
	assertCanManageManagerAssignments(principal);
	await assertCanGrantOnSharedMailbox(db, principal, mailboxId);
	await authorizeAccount(db, principal, accountId, "manage");

	const [target] = await db
		.select({ role: accounts.role })
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!target || target.role !== "manager") {
		throw new Error("Manager assignments only apply to manager accounts");
	}

	const [mailbox] = await db
		.select({ domainId: mailboxes.domainId, type: mailboxes.type })
		.from(mailboxes)
		.where(eq(mailboxes.id, mailboxId))
		.limit(1);
	if (!mailbox || mailbox.type !== "shared") {
		throw new Error("Only shared mailboxes support manager assignments");
	}

	const assignments = await loadManagerSharedMailboxAssignments(db, accountId);
	const hasAllShared = assignments.some(
		(assignment) =>
			assignment.allSharedMailboxes &&
			assignment.domainId === mailbox.domainId,
	);
	const hasExplicit = assignments.some(
		(assignment) => assignment.mailboxId === mailboxId,
	);

	if (!hasAllShared && !hasExplicit) {
		return;
	}

	const emitRevokeLog = async () => {
		if (principal.accountId) {
			await safeEmitLog(db, {
				importance: 5,
				type: "mailboxes",
				summary: "{actor} revoked {account}'s management of {mailbox}",
				refs: {
					actor: { kind: "account", id: principal.accountId },
					account: { kind: "account", id: accountId },
					mailbox: { kind: "mailbox", id: mailboxId },
				},
				actorAccountId: principal.accountId,
				context: logContext,
			});
		}
	};

	if (hasAllShared) {
		await db
			.delete(managerSharedMailboxAssignments)
			.where(eq(managerSharedMailboxAssignments.accountId, accountId));

		for (const assignment of assignments) {
			if (assignment.allSharedMailboxes) {
				const sharedInDomain = await db
					.select({ id: mailboxes.id, domainId: mailboxes.domainId })
					.from(mailboxes)
					.where(
						and(
							eq(mailboxes.domainId, assignment.domainId),
							eq(mailboxes.type, "shared"),
							ne(mailboxes.id, mailboxId),
						),
					);
				for (const sharedMailbox of sharedInDomain) {
					await db.insert(managerSharedMailboxAssignments).values({
						accountId,
						domainId: sharedMailbox.domainId,
						mailboxId: sharedMailbox.id,
						allSharedMailboxes: false,
					});
				}
				continue;
			}

			if (assignment.mailboxId && assignment.mailboxId !== mailboxId) {
				await db.insert(managerSharedMailboxAssignments).values({
					accountId,
					domainId: assignment.domainId,
					mailboxId: assignment.mailboxId,
					allSharedMailboxes: false,
				});
			}
		}
		await emitRevokeLog();
		return;
	}

	await db
		.delete(managerSharedMailboxAssignments)
		.where(
			and(
				eq(managerSharedMailboxAssignments.accountId, accountId),
				eq(managerSharedMailboxAssignments.mailboxId, mailboxId),
			),
		);
	await emitRevokeLog();
}
