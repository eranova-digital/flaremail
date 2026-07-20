export type StoredAttachmentInput = {
	filename: string | null;
	mimeType: string;
	content: ArrayBuffer | ArrayBufferView;
	disposition?: string | null;
	contentId?: string | null;
};
