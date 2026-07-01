import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { attachments, messages } from "../db/schema";

export async function downloadAttachment(
	db: Database,
	bucket: R2Bucket,
	attachmentId: string,
): Promise<Response> {
	const [row] = await db
		.select({
			id: attachments.id,
			filename: attachments.filename,
			mimeType: attachments.mimeType,
			storageKey: attachments.storageKey,
			messageId: attachments.messageId,
		})
		.from(attachments)
		.where(eq(attachments.id, attachmentId))
		.limit(1);

	if (!row) {
		throw new Error("Attachment not found");
	}

	const [message] = await db
		.select({
			direction: messages.direction,
			sendStatus: messages.sendStatus,
		})
		.from(messages)
		.where(eq(messages.id, row.messageId))
		.limit(1);

	if (!message) {
		throw new Error("Attachment not found");
	}

	const canDownload =
		message.direction === "inbound" ||
		(message.direction === "outbound" &&
			(message.sendStatus === "draft" || message.sendStatus === "sent"));

	if (!canDownload) {
		throw new Error("Attachment not found");
	}

	const object = await bucket.get(row.storageKey);
	if (!object) {
		throw new Error("Attachment content not found");
	}

	const headers = new Headers();
	headers.set("Content-Type", row.mimeType);
	if (row.filename) {
		headers.set(
			"Content-Disposition",
			`attachment; filename="${row.filename.replace(/"/g, "")}"`,
		);
	}

	return new Response(object.body, { headers });
}
