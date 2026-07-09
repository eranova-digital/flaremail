import PostalMime from "postal-mime";

import type { Database } from "../../db/client";
import { assertMessageVisibleInMailbox } from "../../lib/thread-mailbox";
import { loadMessageBody } from "../../lib/messages/message-body";
import { findMessageById } from "../../lib/messages/message-queries";
import { resolveViewerDirection, toMessagePreview } from "../dto";

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
