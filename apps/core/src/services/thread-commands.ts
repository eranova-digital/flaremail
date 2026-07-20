import { and, eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { threadMailboxes } from "../db/schema";
import type { ThreadAction } from "../lib/mailbox-types";
import { findThreadMailbox } from "../lib/thread-mailbox";
import { planThreadAction } from "../lib/thread-mailbox/plan-thread-action";

export type { ThreadAction } from "../lib/mailbox-types";

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
	const plan = planThreadAction(
		{
			folder: threadMailbox.folder,
			restoreFolder: threadMailbox.restoreFolder,
		},
		action,
	);

	if (plan.kind === "noop") {
		return threadMailbox;
	}

	const [updated] = await db
		.update(threadMailboxes)
		.set(plan.patch)
		.where(
			and(
				eq(threadMailboxes.threadId, threadId),
				eq(threadMailboxes.mailboxId, mailboxId),
			),
		)
		.returning();

	return updated;
}
