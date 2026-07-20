import type { messages } from "../../db/schema";
import type { ThreadFolder } from "../mailbox-types";

export type ThreadTouchData = {
	subject: string | null;
	preview: string | null;
	lastMessageAt: Date;
	actualMailboxId: string;
	matchedMailboxId?: string | null;
	folder?: ThreadFolder;
	markUnread?: boolean;
};

/** Fired after a message row and visibility links are persisted. */
export type MessagePersistedEvent = {
	threadId: string;
	messageId: string;
	touch: ThreadTouchData;
};

/** Fired after an outbound message is sent and stored. */
export type OutboundSentEvent = {
	threadId: string;
	touch: ThreadTouchData & { promoteFromDrafts?: boolean };
	message?: typeof messages.$inferSelect;
};

/** Fired when a draft's content changes without sending. */
export type DraftUpdatedEvent = {
	threadId: string;
	mailboxId: string;
	touch: Pick<ThreadTouchData, "subject" | "preview" | "lastMessageAt">;
};

/** Fired when a draft message row is removed. */
export type DraftDeletedEvent = {
	threadId: string;
};
