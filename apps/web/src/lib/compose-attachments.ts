import type { OutboundAttachmentInput } from "@/lib/api/client";
import { fetchAttachmentBlob } from "@/lib/attachments";

export type ComposeAttachment =
	| {
			key: string;
			kind: "local";
			file: File;
			filename: string;
			mimeType: string;
			sizeBytes: number;
	  }
	| {
			key: string;
			kind: "stored";
			id: string;
			filename: string;
			mimeType: string;
			sizeBytes: number;
	  };

function createKey(): string {
	return crypto.randomUUID();
}

export function createLocalAttachment(file: File): ComposeAttachment {
	return {
		key: createKey(),
		kind: "local",
		file,
		filename: file.name,
		mimeType: file.type || "application/octet-stream",
		sizeBytes: file.size,
	};
}

export function createStoredAttachment(input: {
	id?: string;
	filename?: string | null;
	mimeType?: string;
	sizeBytes?: number;
}): ComposeAttachment | null {
	if (!input.id) {
		return null;
	}

	return {
		key: input.id,
		kind: "stored",
		id: input.id,
		filename: input.filename?.trim() || "attachment",
		mimeType: input.mimeType || "application/octet-stream",
		sizeBytes: input.sizeBytes ?? 0,
	};
}

async function blobToBase64(blob: Blob): Promise<string> {
	const buffer = await blob.arrayBuffer();
	const bytes = new Uint8Array(buffer);
	let binary = "";

	for (let index = 0; index < bytes.length; index += 1) {
		binary += String.fromCharCode(bytes[index]!);
	}

	return btoa(binary);
}

async function fileToBase64(file: File): Promise<string> {
	return blobToBase64(file);
}

export async function composeAttachmentsToOutbound(
	attachments: ComposeAttachment[],
): Promise<OutboundAttachmentInput[]> {
	return Promise.all(
		attachments.map(async (attachment) => {
			if (attachment.kind === "local") {
				return {
					filename: attachment.filename,
					mimeType: attachment.mimeType,
					content: await fileToBase64(attachment.file),
				};
			}

			const blob = await fetchAttachmentBlob(attachment.id);
			return {
				filename: attachment.filename,
				mimeType: attachment.mimeType,
				content: await blobToBase64(blob),
			};
		}),
	);
}
