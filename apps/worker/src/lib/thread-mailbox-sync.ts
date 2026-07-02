import type { Database } from "../db/client";
import type { messages } from "../db/schema";
import {
	promoteThreadMailboxFromDrafts,
	refreshAllThreadMailboxes,
	relinkMessageMailboxesAfterSend,
	syncThreadMailboxesAfterMessage,
} from "./message-mailboxes";
import type { ThreadTouchData } from "./touch-thread";

export async function onMessagePersisted(
	db: Database,
	threadId: string,
	messageId: string,
	touch: ThreadTouchData,
): Promise<void> {
	await syncThreadMailboxesAfterMessage(db, threadId, messageId, touch);
}

export async function onOutboundSent(
	db: Database,
	threadId: string,
	data: ThreadTouchData & { promoteFromDrafts?: boolean },
	message?: typeof messages.$inferSelect,
): Promise<void> {
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

export async function onDraftDeleted(
	db: Database,
	threadId: string,
): Promise<void> {
	await refreshAllThreadMailboxes(db, threadId);
}
