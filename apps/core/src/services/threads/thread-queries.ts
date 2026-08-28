import { and, desc, eq, exists, isNull, lt, ne, not, or, sql } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	labels,
	mailboxes,
	messageMailboxes,
	messages,
	threadLabels,
	threadMailboxes,
	threads,
} from "../../db/schema";
import {
	buildNextCursor,
	decodeCursor,
	type PaginatedResult,
	parseLimit,
} from "../../lib/http/cursor-pagination";
import type { ThreadFolder } from "../../lib/mailbox-types";
import { assertThreadInMailbox } from "../../lib/thread-mailbox";
import { listLatestMessageSeenByForThreads } from "../../lib/message-seen-by";
import { toThreadDto } from "./dto";
import {
	getBimiDomainsForThreads,
	getLabelIdsForThreads,
	getThreadPartiesForMailbox,
} from "./thread-enrichment";

export async function listThreads(
	db: Database,
	mailboxId: string,
	options: {
		folder?: ThreadFolder | null;
		labelId?: string | null;
		cursor?: string | null;
		limit?: number;
	},
): Promise<PaginatedResult<ReturnType<typeof toThreadDto>>> {
	const limit = options.limit ?? parseLimit(null);
	const cursor = decodeCursor(options.cursor ?? null);

	const conditions = [eq(threadMailboxes.mailboxId, mailboxId)];
	if (options.labelId) {
		conditions.push(
			exists(
				db
					.select({ one: sql`1` })
					.from(threadLabels)
					.innerJoin(labels, eq(labels.id, threadLabels.labelId))
					.where(
						and(
							eq(threadLabels.threadId, threadMailboxes.threadId),
							eq(threadLabels.labelId, options.labelId),
							eq(labels.mailboxId, mailboxId),
						),
					),
			),
		);
	}
	if (options.folder) {
		conditions.push(eq(threadMailboxes.folder, options.folder));
		if (options.folder === "drafts") {
			conditions.push(
				not(
					exists(
						db
							.select({ one: sql`1` })
							.from(messages)
							.innerJoin(
								messageMailboxes,
								eq(messageMailboxes.messageId, messages.id),
							)
							.where(
								and(
									eq(messages.threadId, threadMailboxes.threadId),
									eq(messageMailboxes.mailboxId, mailboxId),
									or(
										isNull(messages.sendStatus),
										ne(messages.sendStatus, "draft"),
									),
								),
							),
					),
				),
			);
		}
	}

	if (cursor) {
		conditions.push(
			or(
				lt(threadMailboxes.lastMessageAt, new Date(cursor.sortAt)),
				and(
					eq(threadMailboxes.lastMessageAt, new Date(cursor.sortAt)),
					lt(threadMailboxes.threadId, cursor.id),
				),
			)!,
		);
	}

	const rows = await db
		.select({
			thread: threads,
			mailboxView: threadMailboxes,
		})
		.from(threadMailboxes)
		.innerJoin(threads, eq(threads.id, threadMailboxes.threadId))
		.where(and(...conditions))
		.orderBy(desc(threadMailboxes.lastMessageAt), desc(threadMailboxes.threadId))
		.limit(limit);

	const labelMap = await getLabelIdsForThreads(
		db,
		mailboxId,
		rows.map((row) => row.thread.id),
	);

	const [mailbox] = await db
		.select({ address: mailboxes.address })
		.from(mailboxes)
		.where(eq(mailboxes.id, mailboxId))
		.limit(1);

	if (!mailbox) {
		throw new Error("Mailbox not found");
	}

	const partiesMap = await getThreadPartiesForMailbox(
		db,
		mailboxId,
		mailbox.address,
		rows.map((row) => row.thread.id),
	);

	const seenByMap = await listLatestMessageSeenByForThreads(
		db,
		mailboxId,
		rows.map((row) => row.thread.id),
	);

	const bimiDomainsMap = await getBimiDomainsForThreads(
		db,
		mailboxId,
		rows.map((row) => row.thread.id),
	);

	const items = rows.map((row) =>
		toThreadDto(
			row.thread,
			row.mailboxView,
			labelMap.get(row.thread.id) ?? [],
			partiesMap.get(row.thread.id),
			seenByMap.get(row.thread.id) ?? [],
			bimiDomainsMap.get(row.thread.id) ?? [],
		),
	);

	const nextCursor = buildNextCursor(
		rows.map((row) => ({
			sortAt: row.mailboxView.lastMessageAt,
			id: row.thread.id,
		})),
		limit,
	);

	return { items, nextCursor };
}

export async function getThread(
	db: Database,
	threadId: string,
	mailboxId: string,
) {
	await assertThreadInMailbox(db, threadId, mailboxId);

	const [row] = await db
		.select({
			thread: threads,
			mailboxView: threadMailboxes,
		})
		.from(threads)
		.innerJoin(
			threadMailboxes,
			and(
				eq(threadMailboxes.threadId, threads.id),
				eq(threadMailboxes.mailboxId, mailboxId),
			),
		)
		.where(eq(threads.id, threadId))
		.limit(1);

	if (!row) {
		throw new Error("Thread not found");
	}

	const labelRows = await db
		.select({ labelId: threadLabels.labelId })
		.from(threadLabels)
		.innerJoin(labels, eq(labels.id, threadLabels.labelId))
		.where(
			and(eq(threadLabels.threadId, threadId), eq(labels.mailboxId, mailboxId)),
		);

	const [mailbox] = await db
		.select({ address: mailboxes.address })
		.from(mailboxes)
		.where(eq(mailboxes.id, mailboxId))
		.limit(1);

	if (!mailbox) {
		throw new Error("Mailbox not found");
	}

	const parties = (
		await getThreadPartiesForMailbox(db, mailboxId, mailbox.address, [
			threadId,
		])
	).get(threadId);

	const seenByMap = await listLatestMessageSeenByForThreads(db, mailboxId, [threadId]);

	const bimiDomainsMap = await getBimiDomainsForThreads(db, mailboxId, [threadId]);

	return toThreadDto(
		row.thread,
		row.mailboxView,
		labelRows.map((labelRow) => labelRow.labelId),
		parties,
		seenByMap.get(threadId) ?? [],
		bimiDomainsMap.get(threadId) ?? [],
	);
}
