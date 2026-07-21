import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "../../db/client";
import { labels, threadLabels, threads } from "../../db/schema";
import { assertThreadInMailbox } from "../../lib/thread-mailbox";
import { getThread } from "./thread-queries";

export async function replaceThreadLabels(
	db: Database,
	threadId: string,
	mailboxId: string,
	labelIds: string[],
) {
	await assertThreadInMailbox(db, threadId, mailboxId);

	const [thread] = await db
		.select({ id: threads.id })
		.from(threads)
		.where(eq(threads.id, threadId))
		.limit(1);

	if (!thread) {
		throw new Error("Thread not found");
	}

	if (labelIds.length) {
		const existing = await db
			.select({ id: labels.id })
			.from(labels)
			.where(
				and(
					eq(labels.mailboxId, mailboxId),
					inArray(labels.id, labelIds),
				),
			);

		if (existing.length !== labelIds.length) {
			throw new Error("One or more labels not found");
		}
	}

	const mailboxLabelRows = await db
		.select({ id: labels.id })
		.from(labels)
		.where(eq(labels.mailboxId, mailboxId));

	const mailboxLabelIds = mailboxLabelRows.map((row) => row.id);

	if (mailboxLabelIds.length) {
		await db
			.delete(threadLabels)
			.where(
				and(
					eq(threadLabels.threadId, threadId),
					inArray(threadLabels.labelId, mailboxLabelIds),
				),
			);
	}

	if (labelIds.length) {
		await db.insert(threadLabels).values(
			labelIds.map((labelId) => ({
				threadId,
				labelId,
			})),
		);
	}

	return getThread(db, threadId, mailboxId);
}
