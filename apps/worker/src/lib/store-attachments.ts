import type { Attachment } from "postal-mime";

import type { NewAttachment } from "../db/schema";
import {
	attachmentContentToArrayBuffer,
	attachmentStorageKey,
	isNonEmptyAttachment,
	normalizeContentId,
	sanitizeFilename,
} from "./attachment-utils";
import type { StoredAttachmentInput } from "./messages/stored-attachment-input";

export function postalAttachmentToStoredInput(
	part: Attachment,
	index: number,
): StoredAttachmentInput | null {
	if (!isNonEmptyAttachment(part)) {
		return null;
	}

	return {
		filename: part.filename,
		mimeType: part.mimeType || "application/octet-stream",
		content: attachmentContentToArrayBuffer(part.content),
		disposition: part.disposition,
		contentId: part.contentId,
	};
}

export async function storeAttachments(
	bucket: R2Bucket,
	messageId: string,
	parts: StoredAttachmentInput[],
): Promise<NewAttachment[]> {
	const stored: NewAttachment[] = [];

	await Promise.all(
		parts.map(async (part, index) => {
			const content = attachmentContentToArrayBuffer(part.content);
			const id = crypto.randomUUID();
			const filename = sanitizeFilename(
				part.filename,
				index,
				part.contentId ?? undefined,
			);
			const storageKey = attachmentStorageKey(messageId, id, filename);

			await bucket.put(storageKey, content, {
				httpMetadata: {
					contentType: part.mimeType || "application/octet-stream",
				},
			});

			stored.push({
				id,
				messageId,
				filename: part.filename,
				mimeType: part.mimeType || "application/octet-stream",
				sizeBytes: content.byteLength,
				disposition: part.disposition ?? null,
				contentId: part.contentId
					? normalizeContentId(part.contentId)
					: null,
				storageKey,
			});
		}),
	);

	return stored;
}

export async function storePostalAttachments(
	bucket: R2Bucket,
	messageId: string,
	parts: Attachment[],
): Promise<NewAttachment[]> {
	const inputs = parts
		.map((part, index) => postalAttachmentToStoredInput(part, index))
		.filter((part): part is StoredAttachmentInput => part !== null);

	return storeAttachments(bucket, messageId, inputs);
}
