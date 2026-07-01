import { and, eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { threadMailboxes } from "../db/schema";

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
