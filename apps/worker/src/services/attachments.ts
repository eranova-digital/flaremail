import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { attachments, messages } from "../db/schema";
import type { Principal } from "../lib/auth/types";
import { assertPrincipalCanReadMessage } from "../lib/email-images/assert-message-readable";

export async function downloadAttachment(
	db: Database,
	bucket: R2Bucket,
	principal: Principal,
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

	await assertPrincipalCanReadMessage(db, principal, row.messageId);

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
	const safeMime =
		row.mimeType.startsWith("image/") ||
		row.mimeType.startsWith("text/") ||
		row.mimeType === "application/pdf"
			? row.mimeType
			: "application/octet-stream";
	headers.set("Content-Type", safeMime);
	headers.set("X-Content-Type-Options", "nosniff");
	const safeName = (row.filename ?? "attachment")
		.replace(/[\r\n"]/g, "")
		.slice(0, 200);
	headers.set(
		"Content-Disposition",
		`attachment; filename="${safeName || "attachment"}"`,
	);

	return new Response(object.body, { headers });
}
