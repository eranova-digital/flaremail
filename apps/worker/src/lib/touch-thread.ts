import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { messages, threads } from "../db/schema";
import type { ThreadFolder } from "./mailbox-types";

export type { ThreadFolder } from "./mailbox-types";

export type ThreadTouchData = {
	subject: string | null;
	preview: string | null;
	lastMessageAt: Date;
	actualMailboxId: string;
	matchedMailboxId?: string | null;
	folder?: ThreadFolder;
	markUnread?: boolean;
};

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
