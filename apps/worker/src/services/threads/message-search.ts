import { and, desc, eq, ilike, lt, or } from "drizzle-orm";

import type { Database } from "../../db/client";
import { messageMailboxes, messages } from "../../db/schema";
import {
	buildNextCursor,
	decodeCursor,
	type PaginatedResult,
	parseLimit,
} from "../../lib/http/cursor-pagination";
import { toSearchHit } from "./dto";

export async function searchMessages(
	db: Database,
	mailboxId: string,
	query: string,
	options: { cursor?: string | null; limit?: number },
): Promise<PaginatedResult<ReturnType<typeof toSearchHit>>> {
	const trimmed = query.trim();
	if (!trimmed) {
		throw new Error("Search query is required");
	}

	const limit = options.limit ?? parseLimit(null);
	const cursor = decodeCursor(options.cursor ?? null);
	const pattern = `%${trimmed}%`;

	const baseWhere = and(
		eq(messageMailboxes.mailboxId, mailboxId),
		or(
			ilike(messages.subject, pattern),
			ilike(messages.textBody, pattern),
			ilike(messages.from, pattern),
			ilike(messages.to, pattern),
		),
	);

	const rows = cursor
		? await db
				.select({ message: messages })
				.from(messages)
				.innerJoin(
					messageMailboxes,
					eq(messageMailboxes.messageId, messages.id),
				)
				.where(
					and(
						baseWhere,
						or(
							lt(messages.receivedAt, new Date(cursor.sortAt)),
							and(
								eq(messages.receivedAt, new Date(cursor.sortAt)),
								lt(messages.id, cursor.id),
							),
						),
					),
				)
				.orderBy(desc(messages.receivedAt), desc(messages.id))
				.limit(limit)
		: await db
				.select({ message: messages })
				.from(messages)
				.innerJoin(
					messageMailboxes,
					eq(messageMailboxes.messageId, messages.id),
				)
				.where(baseWhere)
				.orderBy(desc(messages.receivedAt), desc(messages.id))
				.limit(limit);

	const messageRows = rows.map((row) => row.message);
	const items = messageRows.map(toSearchHit);

	const nextCursor = buildNextCursor(
		messageRows.map((message) => ({
			sortAt: message.receivedAt,
			id: message.id,
		})),
		limit,
	);

	return { items, nextCursor };
}
