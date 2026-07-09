import { and, asc, eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { messageMailboxes, messages } from "../../db/schema";
import { loadMessageBody } from "../../lib/messages/message-body";
import {
	buildRfcMessageIdToUuidMap,
	resolveInReplyToMessageUuid,
	toThreadMessagePreview,
	toThreadMessageWithBody,
} from "../dto";
import { getThread } from "./thread-queries";

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
