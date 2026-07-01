import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "../db/client";
import {
	mailboxes,
	messageMailboxes,
	messages,
	threadMailboxes,
	threads,
} from "../db/schema";
import { extractEmailsFromHeaderValue } from "./extract-emails-from-header";
import type { ThreadFolder, ThreadTouchData } from "./touch-thread";

type MessageVisibilityInput = {
	direction?: string;
	from: string;
	to: string;
	cc?: string | null;
	bcc?: string | null;
	actualMailboxId: string;
	matchedMailboxId?: string | null;
	sendStatus?: string | null;
};

export function headerValuesForMessageVisibility(
	message: Pick<
		MessageVisibilityInput,
		"direction" | "from" | "to" | "cc" | "bcc" | "sendStatus"
	>,
): Array<string | null | undefined> {
	if (message.sendStatus === "draft") {
		return [];
	}

	return (message.direction ?? "inbound") === "inbound"
		? [message.to, message.cc, message.bcc]
		: [message.from, message.to, message.cc, message.bcc];
}

export async function resolveMessageMailboxIds(
	db: Database,
	message: MessageVisibilityInput,
): Promise<string[]> {
	const mailboxIds = new Set<string>([message.actualMailboxId]);

	if (message.matchedMailboxId) {
		mailboxIds.add(message.matchedMailboxId);
	}

	if (message.sendStatus === "draft") {
		return [...mailboxIds];
	}

	const headerValues = headerValuesForMessageVisibility(message);

	const addresses = new Set<string>();
	for (const headerValue of headerValues) {
		for (const email of extractEmailsFromHeaderValue(headerValue)) {
			addresses.add(email);
		}
	}

	if (!addresses.size) {
		return [...mailboxIds];
	}

	const rows = await db
		.select({ id: mailboxes.id, address: mailboxes.address })
		.from(mailboxes)
		.where(inArray(mailboxes.address, [...addresses]));

	for (const row of rows) {
		mailboxIds.add(row.id);
	}

	return [...mailboxIds];
}

export async function linkMessageMailboxes(
	db: Database,
	messageId: string,
	mailboxIds: string[],
): Promise<void> {
	if (!mailboxIds.length) {
		return;
	}

	await Promise.all(
		mailboxIds.map((mailboxId) =>
			db
				.insert(messageMailboxes)
				.values({ messageId, mailboxId })
				.onConflictDoNothing(),
		),
	);
}

export async function assertMessageVisibleInMailbox(
	db: Database,
	messageId: string,
	mailboxId: string,
): Promise<void> {
	const [link] = await db
		.select({ messageId: messageMailboxes.messageId })
		.from(messageMailboxes)
		.where(
			and(
				eq(messageMailboxes.messageId, messageId),
				eq(messageMailboxes.mailboxId, mailboxId),
			),
		)
		.limit(1);

	if (!link) {
		throw new Error("Message not found");
	}
}

export async function findThreadMailbox(
	db: Database,
	threadId: string,
	mailboxId: string,
) {
	const [row] = await db
		.select()
		.from(threadMailboxes)
		.where(
			and(
				eq(threadMailboxes.threadId, threadId),
				eq(threadMailboxes.mailboxId, mailboxId),
			),
		)
		.limit(1);

	return row ?? null;
}

export async function refreshThreadMailboxStats(
	db: Database,
	threadId: string,
	mailboxId: string,
): Promise<void> {
	const [stats] = await db
		.select({
			count: sql<number>`count(*)::int`,
			lastMessageAt: sql<Date>`max(${messages.receivedAt})`,
		})
		.from(messages)
		.innerJoin(
			messageMailboxes,
			and(
				eq(messageMailboxes.messageId, messages.id),
				eq(messageMailboxes.mailboxId, mailboxId),
			),
		)
		.where(eq(messages.threadId, threadId));

	const count = stats?.count ?? 0;

	if (count === 0) {
		await db
			.delete(threadMailboxes)
			.where(
				and(
					eq(threadMailboxes.threadId, threadId),
					eq(threadMailboxes.mailboxId, mailboxId),
				),
			);
		return;
	}

	const [latest] = await db
		.select({
			preview: messages.preview,
			receivedAt: messages.receivedAt,
		})
		.from(messages)
		.innerJoin(
			messageMailboxes,
			and(
				eq(messageMailboxes.messageId, messages.id),
				eq(messageMailboxes.mailboxId, mailboxId),
			),
		)
		.where(eq(messages.threadId, threadId))
		.orderBy(desc(messages.receivedAt))
		.limit(1);

	await db
		.update(threadMailboxes)
		.set({
			preview: latest?.preview ?? null,
			lastMessageAt: latest?.receivedAt ?? stats?.lastMessageAt ?? new Date(),
			messageCount: count,
		})
		.where(
			and(
				eq(threadMailboxes.threadId, threadId),
				eq(threadMailboxes.mailboxId, mailboxId),
			),
		);

	await reconcileThreadFolder(db, threadId, mailboxId);
}

export async function refreshAllThreadMailboxes(
	db: Database,
	threadId: string,
): Promise<void> {
	const links = await db
		.select({ mailboxId: threadMailboxes.mailboxId })
		.from(threadMailboxes)
		.where(eq(threadMailboxes.threadId, threadId));

	for (const link of links) {
		await refreshThreadMailboxStats(db, threadId, link.mailboxId);
	}

	const remainingMessages = await db
		.select({ id: messages.id })
		.from(messages)
		.where(eq(messages.threadId, threadId))
		.limit(1);

	if (!remainingMessages.length) {
		await db.delete(threads).where(eq(threads.id, threadId));
	}
}

export function folderAfterInboundMessage(
	existingFolder: ThreadFolder,
	touchFolder: ThreadFolder | undefined,
): ThreadFolder | undefined {
	if (touchFolder === "inbox" && existingFolder === "sent") {
		return "inbox";
	}

	return undefined;
}

const PRESERVED_FOLDERS = new Set<ThreadFolder>(["trash", "spam", "archived"]);

type MessageFolderInput = {
	sendStatus: string | null;
	direction: string;
};

export function folderForNonDraftThread(
	messageRows: MessageFolderInput[],
): ThreadFolder {
	const nonDrafts = messageRows.filter((row) => row.sendStatus !== "draft");
	const hasInbound = nonDrafts.some((row) => row.direction === "inbound");
	return hasInbound ? "inbox" : "sent";
}

export function reconcileThreadFolderFromMessages(
	existingFolder: ThreadFolder,
	messageRows: MessageFolderInput[],
): ThreadFolder | undefined {
	if (PRESERVED_FOLDERS.has(existingFolder)) {
		return undefined;
	}

	if (!messageRows.length) {
		return undefined;
	}

	const allDrafts = messageRows.every((row) => row.sendStatus === "draft");
	if (allDrafts) {
		return existingFolder === "drafts" ? undefined : "drafts";
	}

	if (existingFolder === "drafts") {
		return folderForNonDraftThread(messageRows);
	}

	return undefined;
}

export async function reconcileThreadFolder(
	db: Database,
	threadId: string,
	mailboxId: string,
): Promise<void> {
	const existing = await findThreadMailbox(db, threadId, mailboxId);
	if (!existing) {
		return;
	}

	const messageRows = await db
		.select({
			sendStatus: messages.sendStatus,
			direction: messages.direction,
		})
		.from(messages)
		.innerJoin(
			messageMailboxes,
			and(
				eq(messageMailboxes.messageId, messages.id),
				eq(messageMailboxes.mailboxId, mailboxId),
			),
		)
		.where(eq(messages.threadId, threadId));

	const folder = reconcileThreadFolderFromMessages(
		existing.folder,
		messageRows,
	);

	if (!folder || folder === existing.folder) {
		return;
	}

	await db
		.update(threadMailboxes)
		.set({ folder })
		.where(
			and(
				eq(threadMailboxes.threadId, threadId),
				eq(threadMailboxes.mailboxId, mailboxId),
			),
		);
}

async function ensureThreadMailbox(
	db: Database,
	threadId: string,
	mailboxId: string,
	touch: ThreadTouchData,
): Promise<boolean> {
	const existing = await findThreadMailbox(db, threadId, mailboxId);

	if (existing) {
		const updates: {
			isRead?: boolean;
			folder?: ThreadFolder;
		} = {};

		if (touch.markUnread !== false) {
			updates.isRead = false;
		}

		const folder = folderAfterInboundMessage(
			existing.folder,
			touch.folder,
		);
		if (folder) {
			updates.folder = folder;
		}

		if (Object.keys(updates).length > 0) {
			await db
				.update(threadMailboxes)
				.set(updates)
				.where(
					and(
						eq(threadMailboxes.threadId, threadId),
						eq(threadMailboxes.mailboxId, mailboxId),
					),
				);
		}

		return false;
	}

	await db.insert(threadMailboxes).values({
		threadId,
		mailboxId,
		preview: touch.preview,
		lastMessageAt: touch.lastMessageAt,
		messageCount: 1,
		isRead: touch.markUnread === false,
		isStarred: false,
		folder: touch.folder ?? "inbox",
	});

	return true;
}

export async function syncThreadMailboxesAfterMessage(
	db: Database,
	threadId: string,
	messageId: string,
	touch: ThreadTouchData,
): Promise<void> {
	const now = new Date();

	await db
		.update(threads)
		.set({
			subject: touch.subject,
			updatedAt: now,
		})
		.where(eq(threads.id, threadId));

	const visibilityRows = await db
		.select({ mailboxId: messageMailboxes.mailboxId })
		.from(messageMailboxes)
		.where(eq(messageMailboxes.messageId, messageId));

	for (const row of visibilityRows) {
		await ensureThreadMailbox(db, threadId, row.mailboxId, touch);
		await refreshThreadMailboxStats(db, threadId, row.mailboxId);
	}
}

export async function promoteThreadMailboxFromDrafts(
	db: Database,
	threadId: string,
	mailboxId: string,
	touch: Pick<ThreadTouchData, "subject" | "preview" | "lastMessageAt">,
): Promise<void> {
	const existing = await findThreadMailbox(db, threadId, mailboxId);

	if (existing?.folder === "drafts") {
		await db
			.update(threadMailboxes)
			.set({
				folder: "sent",
				preview: touch.preview,
				lastMessageAt: touch.lastMessageAt,
			})
			.where(
				and(
					eq(threadMailboxes.threadId, threadId),
					eq(threadMailboxes.mailboxId, mailboxId),
				),
			);
	}

	await db
		.update(threads)
		.set({
			subject: touch.subject,
			updatedAt: new Date(),
		})
		.where(eq(threads.id, threadId));

	await refreshThreadMailboxStats(db, threadId, mailboxId);
}

export function sendRelinkMailboxIds(
	resolvedMailboxIds: string[],
	senderMailboxId: string,
): string[] {
	return [...new Set([...resolvedMailboxIds, senderMailboxId])];
}

export async function relinkMessageMailboxesAfterSend(
	db: Database,
	message: typeof messages.$inferSelect,
	touch: ThreadTouchData,
): Promise<void> {
	const mailboxIds = sendRelinkMailboxIds(
		await resolveMessageMailboxIds(db, message),
		touch.actualMailboxId,
	);
	await linkMessageMailboxes(db, message.id, mailboxIds);

	for (const mailboxId of mailboxIds) {
		await ensureThreadMailbox(db, message.threadId, mailboxId, touch);
		await refreshThreadMailboxStats(db, message.threadId, mailboxId);
	}
}
