import type { Attachment } from "postal-mime";

const UNSAFE_FILENAME_CHARS = /[/\\<>:"|?*\x00-\x1f]/g;

export function normalizeContentId(contentId: string): string {
	return contentId.replace(/^<|>$/g, "").trim();
}

export function sanitizeFilename(
	filename: string | null | undefined,
	index: number,
	contentId?: string,
): string {
	if (filename?.trim()) {
		return filename.trim().replace(UNSAFE_FILENAME_CHARS, "_").slice(0, 200);
	}

	if (contentId) {
		return `inline-${normalizeContentId(contentId).replace(UNSAFE_FILENAME_CHARS, "_").slice(0, 200)}`;
	}

	return `attachment-${index + 1}`;
}

export function attachmentStorageKey(
	messageId: string,
	attachmentId: string,
	filename: string,
): string {
	return `attachments/${messageId}/${attachmentId}/${filename}`;
}

export function attachmentContentToArrayBuffer(
	content: ArrayBuffer | ArrayBufferView | string,
): ArrayBuffer {
	if (typeof content === "string") {
		const bytes = new TextEncoder().encode(content);
		return bytes.buffer.slice(
			bytes.byteOffset,
			bytes.byteOffset + bytes.byteLength,
		) as ArrayBuffer;
	}

	if (content instanceof ArrayBuffer) {
		return content;
	}

	return content.buffer.slice(
		content.byteOffset,
		content.byteOffset + content.byteLength,
	) as ArrayBuffer;
}

export function isNonEmptyAttachment(attachment: Attachment): boolean {
	return attachmentContentToArrayBuffer(attachment.content).byteLength > 0;
}
