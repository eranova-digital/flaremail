import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { attachments } from "../../db/schema";
import { attachmentContentToArrayBuffer } from "../attachment-utils";
import { decodeBase64 } from "./decode-base64";
import type { OutboundMessageBody } from "./outbound-payload";
import type { StoredAttachmentInput } from "./stored-attachment-input";

export type OutboundAttachmentInput = {
	filename: string;
	mimeType: string;
	content: string;
	disposition?: "attachment" | "inline";
	contentId?: string;
};

export function outboundAttachmentsToStoredInputs(
	attachmentInputs: OutboundAttachmentInput[] | undefined,
): StoredAttachmentInput[] {
	if (!attachmentInputs?.length) {
		return [];
	}

	return attachmentInputs.map((attachment) => ({
		filename: attachment.filename,
		mimeType: attachment.mimeType,
		content: decodeBase64(attachment.content),
		disposition: attachment.disposition ?? "attachment",
		contentId: attachment.contentId ?? null,
	}));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}

export function storedInputsToOutboundAttachments(
	attachmentInputs: StoredAttachmentInput[],
): OutboundAttachmentInput[] {
	return attachmentInputs.map((attachment, index) => ({
		filename: attachment.filename?.trim() || `attachment-${index + 1}`,
		mimeType: attachment.mimeType || "application/octet-stream",
		content: arrayBufferToBase64(attachment.content),
		disposition:
			attachment.disposition === "inline" ? "inline" : "attachment",
		contentId: attachment.contentId ?? undefined,
	}));
}

export async function loadStoredAttachmentInputs(
	db: Database,
	bucket: R2Bucket,
	messageId: string,
): Promise<StoredAttachmentInput[]> {
	const rows = await db
		.select({
			filename: attachments.filename,
			mimeType: attachments.mimeType,
			storageKey: attachments.storageKey,
			disposition: attachments.disposition,
			contentId: attachments.contentId,
		})
		.from(attachments)
		.where(eq(attachments.messageId, messageId));

	return Promise.all(
		rows.map(async (row) => {
			const object = await bucket.get(row.storageKey);
			if (!object) {
				throw new Error("Attachment content not found");
			}

			return {
				filename: row.filename,
				mimeType: row.mimeType,
				content: attachmentContentToArrayBuffer(await object.arrayBuffer()),
				disposition: row.disposition,
				contentId: row.contentId,
			};
		}),
	);
}

export async function loadDraftOutboundPayload(
	bucket: R2Bucket,
	draft: {
		id: string;
		to: string;
		cc: string | null;
		bcc: string | null;
		subject: string | null;
		textBody: string | null;
		hasHtml: boolean;
		rawEmlKey: string;
	},
): Promise<OutboundMessageBody> {
	let html: string | undefined;
	let text = draft.textBody ?? undefined;

	if (draft.hasHtml) {
		const raw = await bucket.get(draft.rawEmlKey);
		if (raw) {
			const PostalMime = (await import("postal-mime")).default;
			const parsed = await PostalMime.parse(await raw.arrayBuffer());
			html = parsed.html ?? undefined;
			text = text ?? parsed.text ?? undefined;
		}
	}

	return {
		to: draft.to.split(",").map((address) => address.trim()),
		cc: draft.cc?.split(",").map((address) => address.trim()),
		bcc: draft.bcc?.split(",").map((address) => address.trim()),
		subject: draft.subject ?? "",
		text,
		html,
	};
}
