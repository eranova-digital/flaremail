import PostalMime from "postal-mime";
import { and, asc, desc, eq, exists, ilike, inArray, isNull, lt, ne, not, or, sql } from "drizzle-orm";

import type { Database } from "../db/client";
import {
	labels,
	mailboxes,
	messageMailboxes,
	messages,
	threadLabels,
	threadMailboxes,
	threads,
} from "../db/schema";
import {
	buildNextCursor,
	decodeCursor,
	type PaginatedResult,
	parseLimit,
} from "../lib/http/cursor-pagination";
import { assertMessageVisibleInMailbox } from "../lib/message-mailboxes";
import { loadMessageBody } from "../lib/messages/message-body";
import { findMessageById } from "../lib/messages/message-queries";
import type { ThreadFolder } from "../lib/touch-thread";
import {
	collectThreadParties,
	type ThreadParties,
} from "../lib/thread-participants";
import {
	buildRfcMessageIdToUuidMap,
	resolveInReplyToMessageUuid,
	resolveViewerDirection,
	toMessagePreview,
	toThreadDto,
	toThreadMessagePreview,
	toThreadMessageWithBody,
} from "./dto";
import { assertThreadInMailbox } from "./thread-mailbox-access";

async function getLabelIdsForThreads(
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

async function getThreadPartiesForMailbox(
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

	const items = rows.map((row) =>
		toThreadDto(
			row.thread,
			row.mailboxView,
			labelMap.get(row.thread.id) ?? [],
			partiesMap.get(row.thread.id),
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

	return toThreadDto(
		row.thread,
		row.mailboxView,
		labelRows.map((labelRow) => labelRow.labelId),
		parties,
	);
}

export async function listThreadMessages(
	db: Database,
	threadId: string,
	mailboxId: string,
	options?: { bucket?: R2Bucket; includeBody?: boolean },
) {
	const thread = await getThread(db, threadId, mailboxId);

	const rows = await db
		.select({ message: messages })
		.from(messages)
		.innerJoin(
			messageMailboxes,
			and(
				eq(messageMailboxes.messageId, messages.id),
				eq(messageMailboxes.mailboxId, mailboxId),
			),
		)
		.where(eq(messages.threadId, threadId))
		.orderBy(asc(messages.receivedAt));

	const messageRows = rows.map((row) => row.message);
	const rfcMessageIdToUuid = buildRfcMessageIdToUuidMap(messageRows);

	const mapped = await Promise.all(
		messageRows.map(async (message) => {
			const inReplyTo = resolveInReplyToMessageUuid(
				message.inReplyTo,
				rfcMessageIdToUuid,
			);

			if (options?.includeBody && options.bucket) {
				const body = await loadMessageBody(db, options.bucket, message);
				return toThreadMessageWithBody(message, inReplyTo, body, mailboxId);
			}

			return toThreadMessagePreview(message, inReplyTo, mailboxId);
		}),
	);

	return {
		thread,
		messages: mapped,
	};
}

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

export async function readMessagePreview(
	db: Database,
	messageId: string,
	mailboxId: string,
) {
	await assertMessageVisibleInMailbox(db, messageId, mailboxId);

	const message = await findMessageById(db, messageId);
	if (!message) {
		throw new Error("Message not found");
	}

	return toMessagePreview(message);
}

export async function readMessageFull(
	db: Database,
	bucket: R2Bucket,
	messageId: string,
	mailboxId: string,
) {
	await assertMessageVisibleInMailbox(db, messageId, mailboxId);

	const message = await findMessageById(db, messageId);
	if (!message) {
		throw new Error("Message not found");
	}

	const body = await loadMessageBody(db, bucket, message);
	const object = await bucket.get(message.rawEmlKey);
	const parsed = object
		? await PostalMime.parse(await object.arrayBuffer())
		: null;

	return {
		id: message.id,
		threadId: message.threadId,
		subject: parsed?.subject ?? message.subject,
		text: body.text,
		html: body.html,
		from: message.from,
		to: message.to,
		cc: message.cc,
		bcc: message.bcc,
		direction: resolveViewerDirection(message, mailboxId),
		sendStatus: message.sendStatus,
		rfcMessageId: message.messageId,
		headers: (parsed?.headers ?? []).map((header) => ({
			name: header.key,
			value: header.value,
		})),
		attachments: body.attachments,
		sentAt: message.sentAt?.toISOString() ?? null,
		receivedAt: message.receivedAt.toISOString(),
	};
}

export async function searchMessages(
	db: Database,
	mailboxId: string,
	query: string,
	options: { cursor?: string | null; limit?: number },
): Promise<PaginatedResult<ReturnType<typeof toMessagePreview> & { threadId: string }>> {
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
	const items = messageRows.map((message) => ({
		...toMessagePreview(message),
		threadId: message.threadId,
	}));

	const nextCursor = buildNextCursor(
		messageRows.map((message) => ({
			sortAt: message.receivedAt,
			id: message.id,
		})),
		limit,
	);

	return { items, nextCursor };
}
