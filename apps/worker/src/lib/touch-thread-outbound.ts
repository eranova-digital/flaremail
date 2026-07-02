import type { Database } from "../db/client";
import type { messages } from "../db/schema";
import {
	onDraftDeleted,
	onOutboundSent,
} from "./thread-mailbox-sync";
import type { ThreadTouchData } from "./touch-thread";

export { onDraftDeleted, onMessagePersisted, onOutboundSent } from "./thread-mailbox-sync";

export async function finalizeThreadOnOutboundSend(
	db: Database,
	threadId: string,
	data: ThreadTouchData & { promoteFromDrafts?: boolean },
	message?: typeof messages.$inferSelect,
): Promise<void> {
	await onOutboundSent(db, threadId, data, message);
}

export async function refreshThreadAfterDraftDelete(
	db: Database,
	threadId: string,
): Promise<void> {
	await onDraftDeleted(db, threadId);
}
