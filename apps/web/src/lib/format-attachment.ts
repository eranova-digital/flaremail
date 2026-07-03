import { formatFileSize } from '@/lib/format-bytes';

export type AttachmentPreviewKind = 'image' | 'text' | 'pdf' | 'unsupported';

const TEXT_MIME_PREFIXES = ['text/'] as const;
const TEXT_MIME_TYPES = new Set([
	'application/json',
	'application/xml',
	'application/javascript',
	'application/x-yaml',
	'application/yaml',
]);

export function isImageMimeType(mimeType?: string | null): boolean {
	return Boolean(mimeType?.startsWith('image/'));
}

export function isTextMimeType(mimeType?: string | null): boolean {
	if (!mimeType) {
		return false;
	}

	const normalized = mimeType.toLowerCase();
	return (
		TEXT_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ||
		TEXT_MIME_TYPES.has(normalized)
	);
}

export function isPdfMimeType(mimeType?: string | null): boolean {
	return mimeType?.toLowerCase() === 'application/pdf';
}

export function getAttachmentPreviewKind(
	mimeType?: string | null,
): AttachmentPreviewKind {
	if (isImageMimeType(mimeType)) {
		return 'image';
	}
	if (isTextMimeType(mimeType)) {
		return 'text';
	}
	if (isPdfMimeType(mimeType)) {
		return 'pdf';
	}
	return 'unsupported';
}

export function getAttachmentTypeLabel(
	filename: string,
	mimeType?: string | null,
): string {
	const extension = filename.split('.').pop()?.trim().toUpperCase();
	if (extension && extension.length <= 5) {
		return extension;
	}

	const subtype = mimeType?.split('/')[1]?.toUpperCase();
	return subtype ?? 'FILE';
}

export function formatAttachmentDescription(
	filename: string,
	mimeType?: string | null,
	sizeBytes?: number | null,
): string {
	const typeLabel = getAttachmentTypeLabel(filename, mimeType);
	const sizeLabel = formatFileSize(sizeBytes);
	return [typeLabel, sizeLabel].filter(Boolean).join(' · ');
}
