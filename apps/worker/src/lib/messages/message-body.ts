import { eq } from "drizzle-orm";
import PostalMime from "postal-mime";

import type { Database } from "../../db/client";
import { attachments, type Message } from "../../db/schema";

export type MessageBodyContent = {
	text: string | null;
	html: string | null;
	attachments: Array<{
		id: string;
		filename: string | null;
		mimeType: string;
		sizeBytes: number;
		disposition: string | null;
		contentId: string | null;
	}>;
};

export async function loadMessageBody(
	db: Database,
	bucket: R2Bucket,
	message: Message,
): Promise<MessageBodyContent> {
	const attachmentRows = await db
		.select({
			id: attachments.id,
			filename: attachments.filename,
			mimeType: attachments.mimeType,
			sizeBytes: attachments.sizeBytes,
			disposition: attachments.disposition,
			contentId: attachments.contentId,
		})
		.from(attachments)
		.where(eq(attachments.messageId, message.id));

	const object = await bucket.get(message.rawEmlKey);
	if (!object) {
		return {
			text: message.textBody,
			html: null,
			attachments: attachmentRows,
		};
	}

	const parsed = await PostalMime.parse(await object.arrayBuffer());

	return {
		text: parsed.text ?? message.textBody,
		html: parsed.html ?? null,
		attachments: attachmentRows,
	};
}
