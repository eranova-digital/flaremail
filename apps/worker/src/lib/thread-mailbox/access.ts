import { and, eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { messageMailboxes, threadMailboxes } from "../../db/schema";
import { findThreadMailbox } from "./persistence";

export { findThreadMailbox };

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

export async function assertThreadInMailbox(
	db: Database,
	threadId: string,
	mailboxId: string,
): Promise<void> {
	const [link] = await db
		.select({ threadId: threadMailboxes.threadId })
		.from(threadMailboxes)
		.where(
			and(
				eq(threadMailboxes.threadId, threadId),
				eq(threadMailboxes.mailboxId, mailboxId),
			),
		)
		.limit(1);

	if (!link) {
		throw new Error("Thread not found");
	}
}
