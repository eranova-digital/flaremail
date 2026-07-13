import { and, desc, eq, inArray } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	accountProfiles,
	accounts,
	mailboxes,
	threadMailboxes,
	threadSeenBy,
} from "../../db/schema";
import type { Principal } from "../auth/types";
import { toProfilePicturePayload } from "../profile-picture/payload";

export type ThreadSeenByViewer = {
	accountId: string;
	loginIdentifier: string;
	displayName: string;
	profilePicture: ReturnType<typeof toProfilePicturePayload>;
	seenAt: string;
};

export async function isSharedMailbox(db: Database, mailboxId: string): Promise<boolean> {
	const [row] = await db
		.select({ type: mailboxes.type })
		.from(mailboxes)
		.where(eq(mailboxes.id, mailboxId))
		.limit(1);
	return row?.type === "shared";
}

export async function markThreadSeenBy(
	db: Database,
	principal: Principal,
	input: { threadId: string; mailboxId: string },
): Promise<void> {
	if (!principal.accountId) {
		return;
	}
	if (!(await isSharedMailbox(db, input.mailboxId))) {
		return;
	}

	await db
		.insert(threadSeenBy)
		.values({
			threadId: input.threadId,
			mailboxId: input.mailboxId,
			accountId: principal.accountId,
		})
		.onConflictDoNothing();
}

export async function clearThreadSeenByForSharedMailboxes(
	db: Database,
	threadId: string,
): Promise<void> {
	const sharedLinks = await db
		.select({ mailboxId: threadMailboxes.mailboxId })
		.from(threadMailboxes)
		.innerJoin(mailboxes, eq(mailboxes.id, threadMailboxes.mailboxId))
		.where(and(eq(threadMailboxes.threadId, threadId), eq(mailboxes.type, "shared")));

	const sharedMailboxIds = sharedLinks.map((row) => row.mailboxId);
	if (sharedMailboxIds.length === 0) {
		return;
	}

	await db
		.delete(threadSeenBy)
		.where(and(eq(threadSeenBy.threadId, threadId), inArray(threadSeenBy.mailboxId, sharedMailboxIds)));
}

export async function setThreadSeenBySenderIfSharedOutbound(
	db: Database,
	input: { threadId: string; mailboxId: string; sentByAccountId: string | null | undefined },
): Promise<void> {
	if (!input.sentByAccountId) {
		return;
	}
	// Only add a sender entry for the shared mailbox that actually sent the message.
	if (!(await isSharedMailbox(db, input.mailboxId))) {
		return;
	}
	await db
		.insert(threadSeenBy)
		.values({
			threadId: input.threadId,
			mailboxId: input.mailboxId,
			accountId: input.sentByAccountId,
		})
		.onConflictDoNothing();
}

export async function listThreadSeenByForMailbox(
	db: Database,
	mailboxId: string,
	threadIds: string[],
): Promise<Map<string, ThreadSeenByViewer[]>> {
	const map = new Map<string, ThreadSeenByViewer[]>();
	if (threadIds.length === 0) {
		return map;
	}
	if (!(await isSharedMailbox(db, mailboxId))) {
		return map;
	}

	const rows = await db
		.select({
			threadId: threadSeenBy.threadId,
			accountId: threadSeenBy.accountId,
			loginIdentifier: accounts.loginIdentifier,
			firstName: accountProfiles.firstName,
			lastName: accountProfiles.lastName,
			profilePictureUpdatedAt: accountProfiles.profilePictureUpdatedAt,
			seenAt: threadSeenBy.seenAt,
		})
		.from(threadSeenBy)
		.innerJoin(accounts, eq(accounts.id, threadSeenBy.accountId))
		.leftJoin(accountProfiles, eq(accountProfiles.accountId, accounts.id))
		.where(and(eq(threadSeenBy.mailboxId, mailboxId), inArray(threadSeenBy.threadId, threadIds)))
		.orderBy(desc(threadSeenBy.seenAt));

	for (const row of rows) {
		const entry: ThreadSeenByViewer = {
			accountId: row.accountId,
			loginIdentifier: row.loginIdentifier,
			displayName:
				[row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
				row.loginIdentifier,
			profilePicture: toProfilePicturePayload(row.profilePictureUpdatedAt),
			seenAt: row.seenAt.toISOString(),
		};
		const existing = map.get(row.threadId);
		if (existing) {
			existing.push(entry);
		} else {
			map.set(row.threadId, [entry]);
		}
	}

	return map;
}

