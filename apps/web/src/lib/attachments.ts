import { downloadAttachment } from "@/lib/api/client";

export async function fetchAttachmentBlob(attachmentId: string): Promise<Blob> {
	const { data } = await downloadAttachment({
		throwOnError: true,
		path: { id: attachmentId },
		parseAs: "blob",
	});

	if (!(data instanceof Blob)) {
		throw new Error("Unexpected attachment response");
	}

	return data;
}

export async function saveAttachmentFile(
	attachmentId: string,
	filename: string,
): Promise<void> {
	const blob = await fetchAttachmentBlob(attachmentId);
	saveBlobAsFile(blob, filename);
}

export function saveBlobAsFile(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);

	try {
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = filename;
		anchor.rel = 'noopener';
		anchor.click();
	} finally {
		URL.revokeObjectURL(url);
	}
}

export function saveLocalFile(file: File, filename: string): void {
	saveBlobAsFile(file, filename);
}
