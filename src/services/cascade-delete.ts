import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "../db/client";
import {
	attachments,
	domains,
	labels,
	mailboxes,
	messageMailboxes,
	messages,
	threadLabels,
	threadMailboxes,
	threads,
} from "../db/schema";
import { deleteR2Objects } from "../lib/r2-cleanup";

async function collectR2KeysForMessages(
	db: Database,
	messageIds: string[],
): Promise<string[]> {
	if (!messageIds.length) {
		return [];
	}

	const messageRows = await db
		.select({ rawEmlKey: messages.rawEmlKey })
		.from(messages)
		.where(inArray(messages.id, messageIds));

	const attachmentRows = await db
		.select({ storageKey: attachments.storageKey })
		.from(attachments)
		.where(inArray(attachments.messageId, messageIds));

	return [
		...messageRows.map((row) => row.rawEmlKey),
		...attachmentRows.map((row) => row.storageKey),
	];
}

async function deleteMessagesAndR2(
	db: Database,
	bucket: R2Bucket,
	messageIds: string[],
): Promise<void> {
	if (!messageIds.length) {
		return;
	}

	const keys = await collectR2KeysForMessages(db, messageIds);
	await deleteR2Objects(bucket, keys);
	await db.delete(messages).where(inArray(messages.id, messageIds));
}

async function deleteThreadsFully(
	db: Database,
	bucket: R2Bucket,
	threadIds: string[],
): Promise<void> {
	if (!threadIds.length) {
		return;
	}

	const messageRows = await db
		.select({ id: messages.id })
		.from(messages)
		.where(inArray(messages.threadId, threadIds));

	await deleteMessagesAndR2(
		db,
		bucket,
		messageRows.map((row) => row.id),
	);
	await db.delete(threads).where(inArray(threads.id, threadIds));
}

export async function deleteMailboxCascade(
	db: Database,
	bucket: R2Bucket,
	mailboxId: string,
): Promise<void> {
	await db
		.delete(messageMailboxes)
		.where(eq(messageMailboxes.mailboxId, mailboxId));

	const linkedThreads = await db
		.select({ threadId: threadMailboxes.threadId })
		.from(threadMailboxes)
		.where(eq(threadMailboxes.mailboxId, mailboxId));

	for (const { threadId } of linkedThreads) {
		await db
			.delete(threadMailboxes)
			.where(
				and(
					eq(threadMailboxes.threadId, threadId),
					eq(threadMailboxes.mailboxId, mailboxId),
				),
			);

		const remainingLinks = await db
			.select({ mailboxId: threadMailboxes.mailboxId })
			.from(threadMailboxes)
			.where(eq(threadMailboxes.threadId, threadId));

		if (!remainingLinks.length) {
			await deleteThreadsFully(db, bucket, [threadId]);
			continue;
		}

		const visibleMessages = await db
			.select({ id: messages.id })
			.from(messages)
			.where(eq(messages.threadId, threadId))
			.limit(1);

		if (!visibleMessages.length) {
			await deleteThreadsFully(db, bucket, [threadId]);
		}
	}

	const orphanMessages = await db
		.select({ id: messages.id })
		.from(messages)
		.where(eq(messages.actualMailboxId, mailboxId));

	await deleteMessagesAndR2(
		db,
		bucket,
		orphanMessages.map((row) => row.id),
	);

	await db.delete(labels).where(eq(labels.mailboxId, mailboxId));
	await db.delete(mailboxes).where(eq(mailboxes.id, mailboxId));
}

export async function deleteDomainCascade(
	db: Database,
	bucket: R2Bucket,
	domainId: string,
): Promise<void> {
	const domainMailboxes = await db
		.select({ id: mailboxes.id })
		.from(mailboxes)
		.where(eq(mailboxes.domainId, domainId));

	for (const mailbox of domainMailboxes) {
		await deleteMailboxCascade(db, bucket, mailbox.id);
	}

	await db.delete(domains).where(eq(domains.id, domainId));
}

export async function deleteOrphanThreadLabels(
	db: Database,
	threadId: string,
): Promise<void> {
	const threadLabelRows = await db
		.select({ labelId: threadLabels.labelId })
		.from(threadLabels)
		.where(eq(threadLabels.threadId, threadId));

	if (!threadLabelRows.length) {
		return;
	}

	const labelIds = threadLabelRows.map((row) => row.labelId);
	const existingLabels = await db
		.select({ id: labels.id })
		.from(labels)
		.where(inArray(labels.id, labelIds));

	const existingIds = new Set(existingLabels.map((row) => row.id));
	const staleIds = labelIds.filter((id) => !existingIds.has(id));

	if (staleIds.length) {
		await db
			.delete(threadLabels)
			.where(
				and(
					eq(threadLabels.threadId, threadId),
					inArray(threadLabels.labelId, staleIds),
				),
			);
	}
}
