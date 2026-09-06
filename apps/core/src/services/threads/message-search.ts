import { parseSearchQuery } from "@flaremail/mail-search-query";
import { and, desc, eq, inArray, lt, not, or, sql } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	mailboxes,
	messageMailboxes,
	messages,
	threadMailboxes,
	threads,
} from "../../db/schema";
import {
	buildNextCursor,
	decodeCursor,
	type PaginatedResult,
	parseLimit,
} from "../../lib/http/cursor-pagination";
import { compileMessagePred, compileThreadMatch } from "./search-compile";
import { toMessagePreview, toThreadDto } from "./dto";
import {
	getBimiDomainsForThreads,
	getLabelIdsForThreads,
	getThreadPartiesForMailbox,
} from "./thread-enrichment";
import { listLatestMessageSeenByForThreads } from "../../lib/message-seen-by";

export async function searchMessages(
	db: Database,
	mailboxId: string,
	query: string,
	options: { cursor?: string | null; limit?: number },
	now: Date = new Date(),
): Promise<
	PaginatedResult<{
		thread: ReturnType<typeof toThreadDto>;
		hits: ReturnType<typeof toMessagePreview>[];
	}>
> {
	const parsed = parseSearchQuery(query);
	const limit = options.limit ?? parseLimit(null);
	const cursor = decodeCursor(options.cursor ?? null);
	const ctx = { db, mailboxId, now };

	const match = compileThreadMatch(ctx, parsed.ast);
	const conditions = [eq(threadMailboxes.mailboxId, mailboxId), match];
	if (!parsed.hasInOperator) {
		conditions.push(
			not(inArray(threadMailboxes.folder, ["trash", "spam"])),
		);
	}

	const hitPred = parsed.messageAst
		? compileMessagePred(ctx, parsed.messageAst)
		: null;

	const sortAt = hitPred
		? sql<Date>`coalesce((
			select max(${messages.receivedAt})
			from ${messages}
			inner join ${messageMailboxes}
				on ${eq(messageMailboxes.messageId, messages.id)}
			where ${eq(messageMailboxes.mailboxId, mailboxId)}
				and ${eq(messages.threadId, threadMailboxes.threadId)}
				and ${hitPred}
		), ${threadMailboxes.lastMessageAt})`
		: sql<Date>`${threadMailboxes.lastMessageAt}`;

	if (cursor) {
		const cursorDate = new Date(cursor.sortAt);
		conditions.push(
			or(
				lt(sortAt, cursorDate),
				and(eq(sortAt, cursorDate), lt(threadMailboxes.threadId, cursor.id)),
			)!,
		);
	}

	const rows = await db
		.select({
			thread: threads,
			mailboxView: threadMailboxes,
			sortAt,
		})
		.from(threadMailboxes)
		.innerJoin(threads, eq(threads.id, threadMailboxes.threadId))
		.where(and(...conditions))
		.orderBy(desc(sortAt), desc(threadMailboxes.threadId))
		.limit(limit);

	const threadIds = rows.map((row) => row.thread.id);
	const hitsByThread = await loadHits(db, mailboxId, threadIds, hitPred);

	const labelMap = await getLabelIdsForThreads(db, mailboxId, threadIds);
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
		threadIds,
	);
	const seenByMap = await listLatestMessageSeenByForThreads(
		db,
		mailboxId,
		threadIds,
	);
	const bimiDomainsMap = await getBimiDomainsForThreads(
		db,
		mailboxId,
		threadIds,
	);

	const items = rows.map((row) => ({
		thread: toThreadDto(
			row.thread,
			row.mailboxView,
			labelMap.get(row.thread.id) ?? [],
			partiesMap.get(row.thread.id),
			seenByMap.get(row.thread.id) ?? [],
			bimiDomainsMap.get(row.thread.id) ?? [],
		),
		hits: hitsByThread.get(row.thread.id) ?? [],
	}));

	const nextCursor = buildNextCursor(
		rows.map((row) => ({
			sortAt: row.sortAt instanceof Date ? row.sortAt : new Date(row.sortAt),
			id: row.thread.id,
		})),
		limit,
	);

	return { items, nextCursor };
}

async function loadHits(
	db: Database,
	mailboxId: string,
	threadIds: string[],
	hitPred: ReturnType<typeof compileMessagePred> | null,
) {
	const grouped = new Map<string, ReturnType<typeof toMessagePreview>[]>();
	if (!hitPred || threadIds.length === 0) {
		return grouped;
	}

	const rows = await db
		.select({ message: messages })
		.from(messages)
		.innerJoin(
			messageMailboxes,
			eq(messageMailboxes.messageId, messages.id),
		)
		.where(
			and(
				eq(messageMailboxes.mailboxId, mailboxId),
				inArray(messages.threadId, threadIds),
				hitPred,
			),
		)
		.orderBy(desc(messages.receivedAt), desc(messages.id));

	for (const row of rows) {
		const list = grouped.get(row.message.threadId) ?? [];
		list.push(toMessagePreview(row.message));
		grouped.set(row.message.threadId, list);
	}

	return grouped;
}
