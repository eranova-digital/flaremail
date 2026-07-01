import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { messages, threads } from "../../db/schema";

export async function findMessageById(db: Database, messageId: string) {
	const [row] = await db
		.select()
		.from(messages)
		.where(eq(messages.id, messageId))
		.limit(1);

	return row ?? null;
}

export async function findLatestMessageInThread(
	db: Database,
	threadId: string,
) {
	const [row] = await db
		.select()
		.from(messages)
		.where(eq(messages.threadId, threadId))
		.orderBy(desc(messages.receivedAt))
		.limit(1);

	return row ?? null;
}

export async function findDraftForMailbox(
	db: Database,
	messageId: string,
	mailboxId: string,
) {
	const [row] = await db
		.select()
		.from(messages)
		.where(
			and(
				eq(messages.id, messageId),
				eq(messages.actualMailboxId, mailboxId),
				eq(messages.direction, "outbound"),
				eq(messages.sendStatus, "draft"),
			),
		)
		.limit(1);

	return row ?? null;
}

export async function findDraftById(db: Database, messageId: string) {
	const [row] = await db
		.select()
		.from(messages)
		.where(
			and(
				eq(messages.id, messageId),
				eq(messages.direction, "outbound"),
				eq(messages.sendStatus, "draft"),
			),
		)
		.limit(1);

	return row ?? null;
}

export async function findThreadById(db: Database, threadId: string) {
	const [row] = await db
		.select()
		.from(threads)
		.where(eq(threads.id, threadId))
		.limit(1);

	return row ?? null;
}

export function serializeMessage(message: typeof messages.$inferSelect) {
	return {
		id: message.id,
		threadId: message.threadId,
		messageId: message.messageId,
		direction: message.direction,
		sendStatus: message.sendStatus,
		from: message.from,
		to: message.to,
		cc: message.cc,
		bcc: message.bcc,
		subject: message.subject,
		textBody: message.textBody,
		preview: message.preview,
		hasHtml: message.hasHtml,
		hasAttachments: message.hasAttachments,
		inReplyTo: message.inReplyTo,
		references: message.references,
		sentAt: message.sentAt?.toISOString() ?? null,
		receivedAt: message.receivedAt.toISOString(),
		sendErrorCode: message.sendErrorCode,
		sendErrorMessage: message.sendErrorMessage,
	};
}
