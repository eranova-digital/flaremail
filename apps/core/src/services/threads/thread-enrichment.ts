import { and, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	labels,
	messageMailboxes,
	messages,
	threadLabels,
} from "../../db/schema";
import {
	collectThreadParties,
	type ThreadParties,
} from "../../lib/thread-participants";

export async function getLabelIdsForThreads(
	db: Database,
	mailboxId: string,
	threadIds: string[],
): Promise<Map<string, string[]>> {
	if (!threadIds.length) {
		return new Map();
	}

	const rows = await db
		.select({
			threadId: threadLabels.threadId,
			labelId: threadLabels.labelId,
		})
		.from(threadLabels)
		.innerJoin(labels, eq(labels.id, threadLabels.labelId))
		.where(
			and(
				eq(labels.mailboxId, mailboxId),
				sql`${threadLabels.threadId} IN (${sql.join(
					threadIds.map((id) => sql`${id}`),
					sql`, `,
				)})`,
			),
		);

	const map = new Map<string, string[]>();
	for (const row of rows) {
		const existing = map.get(row.threadId) ?? [];
		existing.push(row.labelId);
		map.set(row.threadId, existing);
	}

	return map;
}

export async function getThreadPartiesForMailbox(
	db: Database,
	mailboxId: string,
	mailboxAddress: string,
	threadIds: string[],
): Promise<Map<string, ThreadParties>> {
	const result = new Map<string, ThreadParties>();
	if (!threadIds.length) {
		return result;
	}

	const rows = await db
		.select({
			threadId: messages.threadId,
			from: messages.from,
			to: messages.to,
			cc: messages.cc,
			receivedAt: messages.receivedAt,
		})
		.from(messages)
		.innerJoin(
			messageMailboxes,
			and(
				eq(messageMailboxes.messageId, messages.id),
				eq(messageMailboxes.mailboxId, mailboxId),
			),
		)
		.where(inArray(messages.threadId, threadIds));

	const byThread = new Map<string, typeof rows>();
	for (const row of rows) {
		const threadMessages = byThread.get(row.threadId) ?? [];
		threadMessages.push(row);
		byThread.set(row.threadId, threadMessages);
	}

	for (const threadId of threadIds) {
		result.set(
			threadId,
			collectThreadParties(byThread.get(threadId) ?? [], mailboxAddress),
		);
	}

	return result;
}
