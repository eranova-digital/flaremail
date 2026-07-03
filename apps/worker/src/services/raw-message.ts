import type { Database } from "../db/client";
import { assertMessageVisibleInMailbox } from "../lib/message-mailboxes";
import { findMessageById } from "../lib/messages/message-queries";

export async function downloadRawMessage(
	db: Database,
	bucket: R2Bucket,
	messageId: string,
	mailboxId: string,
): Promise<Response> {
	await assertMessageVisibleInMailbox(db, messageId, mailboxId);

	const message = await findMessageById(db, messageId);
	if (!message) {
		throw new Error("Message not found");
	}

	const object = await bucket.get(message.rawEmlKey);
	if (!object) {
		throw new Error("Raw message not found");
	}

	const headers = new Headers();
	headers.set("Content-Type", "message/rfc822");
	headers.set(
		"Content-Disposition",
		`attachment; filename="${messageId}.eml"`,
	);

	return new Response(object.body, { headers });
}
