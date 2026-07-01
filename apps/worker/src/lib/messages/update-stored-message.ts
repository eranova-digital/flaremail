import { eq } from "drizzle-orm";

import { attachments, messages } from "../../db/schema";
import type { Database } from "../../db/client";
import { buildStrippedEml } from "../build-stripped-eml";
import { deleteR2Objects } from "../r2-cleanup";
import { storeAttachments } from "../store-attachments";
import { storeRawEml } from "../store-raw-eml";
import type { MimeMessageContent } from "./mime-message-content";
import type { StoredAttachmentInput } from "./stored-attachment-input";

export async function replaceStoredMessageContent(
	db: Database,
	bucket: R2Bucket,
	messageId: string,
	mimeContent: MimeMessageContent,
	attachmentInputs: StoredAttachmentInput[],
	row: Partial<typeof messages.$inferInsert>,
): Promise<string> {
	const [existing] = await db
		.select({ rawEmlKey: messages.rawEmlKey })
		.from(messages)
		.where(eq(messages.id, messageId))
		.limit(1);

	if (!existing) {
		throw new Error("Message not found");
	}

	const existingAttachments = await db
		.select({ storageKey: attachments.storageKey })
		.from(attachments)
		.where(eq(attachments.messageId, messageId));

	const keysToDelete = [
		existing.rawEmlKey,
		...existingAttachments.map((attachment) => attachment.storageKey),
	];

	const storedAttachments = await storeAttachments(
		bucket,
		messageId,
		attachmentInputs,
	);
	const strippedEml = buildStrippedEml(
		mimeContent,
		storedAttachments.map((attachment) => attachment.storageKey),
	);
	const rawEmlKey = await storeRawEml(bucket, messageId, strippedEml);

	try {
		await db.delete(attachments).where(eq(attachments.messageId, messageId));
		if (storedAttachments.length > 0) {
			await db.insert(attachments).values(storedAttachments);
		}

		await db
			.update(messages)
			.set({
				...row,
				rawEmlKey,
				hasAttachments: storedAttachments.length > 0,
			})
			.where(eq(messages.id, messageId));
	} catch (error) {
		await deleteR2Objects(bucket, [
			rawEmlKey,
			...storedAttachments.map((attachment) => attachment.storageKey),
		]);
		throw error;
	}

	await deleteR2Objects(bucket, keysToDelete);
	return rawEmlKey;
}
