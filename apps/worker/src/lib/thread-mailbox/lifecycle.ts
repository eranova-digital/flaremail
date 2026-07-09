import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { messages, threads } from "../../db/schema";
import {
	promoteThreadMailboxFromDrafts,
	refreshAllThreadMailboxes,
	refreshThreadMailboxStats,
	relinkMessageMailboxesAfterSend,
	syncThreadMailboxesAfterMessage,
} from "./persistence";
import type {
	DraftDeletedEvent,
	DraftUpdatedEvent,
	MessagePersistedEvent,
	OutboundSentEvent,
	ThreadTouchData,
} from "./types";

export async function prepareThreadForMessage(
	db: Database,
	threadId: string,
	data: ThreadTouchData,
): Promise<{ isNew: boolean }> {
	const [existing] = await db
		.select({ id: threads.id })
		.from(threads)
		.where(eq(threads.id, threadId))
		.limit(1);

	if (existing) {
		return { isNew: false };
	}

	await db.insert(threads).values({
		id: threadId,
		subject: data.subject,
	});

	return { isNew: true };
}

export async function deleteThreadIfEmpty(
	db: Database,
	threadId: string,
): Promise<void> {
	const [remaining] = await db
		.select({ id: messages.id })
		.from(messages)
		.where(eq(messages.threadId, threadId))
		.limit(1);

	if (!remaining) {
		await db.delete(threads).where(eq(threads.id, threadId));
	}
}

export async function onMessagePersisted(
	db: Database,
	event: MessagePersistedEvent,
): Promise<void> {
	await syncThreadMailboxesAfterMessage(
		db,
		event.threadId,
		event.messageId,
		event.touch,
	);
}
export async function onOutboundSent(
	db: Database,
	event: OutboundSentEvent,
): Promise<void> {
	const { threadId, touch: data, message } = event;

	if (message) {
		await relinkMessageMailboxesAfterSend(db, message, data);
	}

	if (data.promoteFromDrafts) {
		await promoteThreadMailboxFromDrafts(db, threadId, data.actualMailboxId, {
			subject: data.subject,
			preview: data.preview,
			lastMessageAt: data.lastMessageAt,
		});
		return;
	}

	await refreshAllThreadMailboxes(db, threadId);
}

export async function onDraftUpdated(
	db: Database,
	event: DraftUpdatedEvent,
): Promise<void> {
	const { threadId, mailboxId, touch } = event;
	const now = new Date();

	await db
		.update(threads)
		.set({
			subject: touch.subject,
			updatedAt: now,
		})
		.where(eq(threads.id, threadId));

	await refreshThreadMailboxStats(db, threadId, mailboxId);
}

export async function onDraftDeleted(
	db: Database,
	event: DraftDeletedEvent,
): Promise<void> {
	await refreshAllThreadMailboxes(db, event.threadId);
}
