import { and, desc, eq, lt, or } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	messageMailboxes,
	messages,
	threadMailboxes,
	type Message,
} from "../../db/schema";
import {
	buildNextCursor,
	decodeCursor,
	type PaginatedResult,
	parseLimit,
} from "../../lib/http/cursor-pagination";
import type { ThreadFolder } from "../../lib/mailbox-types";
import { toMessagePreview } from "./dto";

export type DraftListItem = ReturnType<typeof toMessagePreview> & {
	composeOnly: boolean;
	threadFolder: ThreadFolder | null;
};

function toDraftListItem(
	message: Message,
	threadFolder: ThreadFolder | null,
): DraftListItem {
	return {
		...toMessagePreview(message),
		composeOnly: threadFolder === "drafts" || threadFolder === null,
		threadFolder,
	};
}

export async function listDraftMessages(
	db: Database,
	mailboxId: string,
	options: { cursor?: string | null; limit?: number },
): Promise<PaginatedResult<DraftListItem>> {
	const limit = options.limit ?? parseLimit(null);
	const cursor = decodeCursor(options.cursor ?? null);

	const baseWhere = and(
		eq(messageMailboxes.mailboxId, mailboxId),
		eq(messages.direction, "outbound"),
		eq(messages.sendStatus, "draft"),
	);

	const rows = cursor
		? await db
				.select({
					message: messages,
					threadFolder: threadMailboxes.folder,
				})
				.from(messages)
				.innerJoin(
					messageMailboxes,
					eq(messageMailboxes.messageId, messages.id),
				)
				.leftJoin(
					threadMailboxes,
					and(
						eq(threadMailboxes.threadId, messages.threadId),
						eq(threadMailboxes.mailboxId, mailboxId),
					),
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
				.select({
					message: messages,
					threadFolder: threadMailboxes.folder,
				})
				.from(messages)
				.innerJoin(
					messageMailboxes,
					eq(messageMailboxes.messageId, messages.id),
				)
				.leftJoin(
					threadMailboxes,
					and(
						eq(threadMailboxes.threadId, messages.threadId),
						eq(threadMailboxes.mailboxId, mailboxId),
					),
				)
				.where(baseWhere)
				.orderBy(desc(messages.receivedAt), desc(messages.id))
				.limit(limit);

	const items = rows.map((row) =>
		toDraftListItem(row.message, row.threadFolder ?? null),
	);

	const nextCursor = buildNextCursor(
		rows.map((row) => ({
			sortAt: row.message.receivedAt,
			id: row.message.id,
		})),
		limit,
	);

	return { items, nextCursor };
}
