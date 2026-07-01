import { and, eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { threadMailboxes } from "../db/schema";
import type { ThreadFolder } from "../lib/touch-thread";
import { findThreadMailbox } from "./thread-mailbox";

const DESTRUCTIVE_FOLDERS = new Set<ThreadFolder>(["trash", "spam", "archived"]);

export type ThreadAction =
	| "archive"
	| "trash"
	| "spam"
	| "restore"
	| "mark-read"
	| "mark-unread"
	| "star"
	| "unstar";

async function getThreadMailboxOrThrow(
	db: Database,
	threadId: string,
	mailboxId: string,
) {
	const row = await findThreadMailbox(db, threadId, mailboxId);
	if (!row) {
		throw new Error("Thread not found");
	}

	return row;
}

export async function runThreadAction(
	db: Database,
	threadId: string,
	mailboxId: string,
	action: ThreadAction,
) {
	const threadMailbox = await getThreadMailboxOrThrow(db, threadId, mailboxId);
	const now = new Date();

	switch (action) {
		case "archive": {
			if (threadMailbox.folder === "archived") {
				return threadMailbox;
			}

			const [updated] = await db
				.update(threadMailboxes)
				.set({
					restoreFolder: DESTRUCTIVE_FOLDERS.has(threadMailbox.folder)
						? threadMailbox.restoreFolder
						: threadMailbox.folder,
					folder: "archived",
					archivedAt: now,
				})
				.where(
					and(
						eq(threadMailboxes.threadId, threadId),
						eq(threadMailboxes.mailboxId, mailboxId),
					),
				)
				.returning();

			return updated;
		}
		case "trash": {
			if (threadMailbox.folder === "trash") {
				return threadMailbox;
			}

			const [updated] = await db
				.update(threadMailboxes)
				.set({
					restoreFolder: DESTRUCTIVE_FOLDERS.has(threadMailbox.folder)
						? threadMailbox.restoreFolder
						: threadMailbox.folder,
					folder: "trash",
					trashedAt: now,
				})
				.where(
					and(
						eq(threadMailboxes.threadId, threadId),
						eq(threadMailboxes.mailboxId, mailboxId),
					),
				)
				.returning();

			return updated;
		}
		case "spam": {
			if (threadMailbox.folder === "spam") {
				return threadMailbox;
			}

			const [updated] = await db
				.update(threadMailboxes)
				.set({
					restoreFolder: DESTRUCTIVE_FOLDERS.has(threadMailbox.folder)
						? threadMailbox.restoreFolder
						: threadMailbox.folder,
					folder: "spam",
					markedAsSpamAt: now,
				})
				.where(
					and(
						eq(threadMailboxes.threadId, threadId),
						eq(threadMailboxes.mailboxId, mailboxId),
					),
				)
				.returning();

			return updated;
		}
		case "restore": {
			const targetFolder = threadMailbox.restoreFolder ?? "inbox";
			const [updated] = await db
				.update(threadMailboxes)
				.set({
					folder: targetFolder,
					restoreFolder: null,
					archivedAt: null,
					trashedAt: null,
					markedAsSpamAt: null,
				})
				.where(
					and(
						eq(threadMailboxes.threadId, threadId),
						eq(threadMailboxes.mailboxId, mailboxId),
					),
				)
				.returning();

			return updated;
		}
		case "mark-read": {
			const [updated] = await db
				.update(threadMailboxes)
				.set({ isRead: true })
				.where(
					and(
						eq(threadMailboxes.threadId, threadId),
						eq(threadMailboxes.mailboxId, mailboxId),
					),
				)
				.returning();

			return updated;
		}
		case "mark-unread": {
			const [updated] = await db
				.update(threadMailboxes)
				.set({ isRead: false })
				.where(
					and(
						eq(threadMailboxes.threadId, threadId),
						eq(threadMailboxes.mailboxId, mailboxId),
					),
				)
				.returning();

			return updated;
		}
		case "star": {
			const [updated] = await db
				.update(threadMailboxes)
				.set({ isStarred: true })
				.where(
					and(
						eq(threadMailboxes.threadId, threadId),
						eq(threadMailboxes.mailboxId, mailboxId),
					),
				)
				.returning();

			return updated;
		}
		case "unstar": {
			const [updated] = await db
				.update(threadMailboxes)
				.set({ isStarred: false })
				.where(
					and(
						eq(threadMailboxes.threadId, threadId),
						eq(threadMailboxes.mailboxId, mailboxId),
					),
				)
				.returning();

			return updated;
		}
		default:
			throw new Error("Unknown thread action");
	}
}
