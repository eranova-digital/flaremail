import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	accountProfiles,
	accounts,
	mailboxes,
	messageMailboxes,
	messageSeenBy,
	messages,
} from "../../db/schema";
import type { Principal } from "../auth/types";
import { toProfilePicturePayload } from "../profile-picture/payload";

export type SeenByViewer = {
	accountId: string;
	loginIdentifier: string;
	displayName: string;
	profilePicture: ReturnType<typeof toProfilePicturePayload>;
	seenAt: string;
};

/** @deprecated Use SeenByViewer */
export type ThreadSeenByViewer = SeenByViewer;

function toSeenByViewer(row: {
	accountId: string;
	loginIdentifier: string;
	firstName: string | null;
	lastName: string | null;
	profilePictureUpdatedAt: Date | null;
	seenAt: Date;
}): SeenByViewer {
	return {
		accountId: row.accountId,
		loginIdentifier: row.loginIdentifier,
		displayName:
			[row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
			row.loginIdentifier,
		profilePicture: toProfilePicturePayload(row.profilePictureUpdatedAt),
		seenAt: row.seenAt.toISOString(),
	};
}

export async function isSharedMailbox(db: Database, mailboxId: string): Promise<boolean> {
	const [row] = await db
		.select({ type: mailboxes.type })
		.from(mailboxes)
		.where(eq(mailboxes.id, mailboxId))
		.limit(1);
	return row?.type === "shared";
}

const nonDraftMessageFilter = or(
	isNull(messages.sendStatus),
	ne(messages.sendStatus, "draft"),
);

async function listNonDraftMessageIdsForThread(
	db: Database,
	threadId: string,
	mailboxId: string,
): Promise<string[]> {
	const rows = await db
		.select({ id: messages.id })
		.from(messages)
		.innerJoin(
			messageMailboxes,
			and(
				eq(messageMailboxes.messageId, messages.id),
				eq(messageMailboxes.mailboxId, mailboxId),
			),
		)
		.where(and(eq(messages.threadId, threadId), nonDraftMessageFilter));

	return rows.map((row) => row.id);
}

export async function markThreadMessagesSeenBy(
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

	const messageIds = await listNonDraftMessageIdsForThread(
		db,
		input.threadId,
		input.mailboxId,
	);
	if (messageIds.length === 0) {
		return;
	}

	await db
		.insert(messageSeenBy)
		.values(
			messageIds.map((messageId) => ({
				messageId,
				mailboxId: input.mailboxId,
				accountId: principal.accountId!,
			})),
		)
		.onConflictDoNothing();
}

export async function setMessageSeenBySender(
	db: Database,
	input: {
		messageId: string;
		mailboxId: string;
		sentByAccountId: string | null | undefined;
	},
): Promise<void> {
	if (!input.sentByAccountId) {
		return;
	}
	if (!(await isSharedMailbox(db, input.mailboxId))) {
		return;
	}

	await db
		.insert(messageSeenBy)
		.values({
			messageId: input.messageId,
			mailboxId: input.mailboxId,
			accountId: input.sentByAccountId,
		})
		.onConflictDoNothing();
}

async function loadSeenByRows(
	db: Database,
	mailboxId: string,
	messageIds: string[],
): Promise<Map<string, SeenByViewer[]>> {
	const map = new Map<string, SeenByViewer[]>();
	if (messageIds.length === 0) {
		return map;
	}
	if (!(await isSharedMailbox(db, mailboxId))) {
		return map;
	}

	const rows = await db
		.select({
			messageId: messageSeenBy.messageId,
			accountId: messageSeenBy.accountId,
			loginIdentifier: accounts.loginIdentifier,
			firstName: accountProfiles.firstName,
			lastName: accountProfiles.lastName,
			profilePictureUpdatedAt: accountProfiles.profilePictureUpdatedAt,
			seenAt: messageSeenBy.seenAt,
		})
		.from(messageSeenBy)
		.innerJoin(accounts, eq(accounts.id, messageSeenBy.accountId))
		.leftJoin(accountProfiles, eq(accountProfiles.accountId, accounts.id))
		.where(
			and(
				eq(messageSeenBy.mailboxId, mailboxId),
				inArray(messageSeenBy.messageId, messageIds),
			),
		)
		.orderBy(desc(messageSeenBy.seenAt));

	for (const row of rows) {
		const entry = toSeenByViewer(row);
		const existing = map.get(row.messageId);
		if (existing) {
			existing.push(entry);
		} else {
			map.set(row.messageId, [entry]);
		}
	}

	return map;
}

export async function listMessageSeenByForMessages(
	db: Database,
	mailboxId: string,
	messageIds: string[],
): Promise<Map<string, SeenByViewer[]>> {
	return loadSeenByRows(db, mailboxId, messageIds);
}

async function getLatestMessageIdPerThread(
	db: Database,
	mailboxId: string,
	threadIds: string[],
): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	if (threadIds.length === 0) {
		return map;
	}

	const rows = await db
		.select({
			threadId: messages.threadId,
			messageId: messages.id,
		})
		.from(messages)
		.innerJoin(
			messageMailboxes,
			and(
				eq(messageMailboxes.messageId, messages.id),
				eq(messageMailboxes.mailboxId, mailboxId),
			),
		)
		.where(and(inArray(messages.threadId, threadIds), nonDraftMessageFilter))
		.orderBy(messages.threadId, desc(messages.receivedAt));

	for (const row of rows) {
		if (!map.has(row.threadId)) {
			map.set(row.threadId, row.messageId);
		}
	}

	return map;
}

export async function listLatestMessageSeenByForThreads(
	db: Database,
	mailboxId: string,
	threadIds: string[],
): Promise<Map<string, SeenByViewer[]>> {
	const threadMap = new Map<string, SeenByViewer[]>();
	if (threadIds.length === 0) {
		return threadMap;
	}
	if (!(await isSharedMailbox(db, mailboxId))) {
		return threadMap;
	}

	const latestMessageByThread = await getLatestMessageIdPerThread(
		db,
		mailboxId,
		threadIds,
	);
	const messageIds = [...latestMessageByThread.values()];
	const seenByByMessage = await loadSeenByRows(db, mailboxId, messageIds);

	for (const [threadId, messageId] of latestMessageByThread) {
		threadMap.set(threadId, seenByByMessage.get(messageId) ?? []);
	}

	return threadMap;
}
