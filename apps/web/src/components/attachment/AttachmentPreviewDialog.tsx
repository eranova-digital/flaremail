import { Download, FileIcon, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
	fetchAttachmentBlob,
	saveAttachmentFile,
	saveLocalFile,
} from '@/lib/attachments';
import { getErrorMessage } from '@/lib/api/errors';
import {
	formatAttachmentDescription,
	getAttachmentPreviewKind,
	type AttachmentPreviewKind,
} from '@/lib/format-attachment';
import { cn } from '@/lib/utils';

const TEXT_PREVIEW_MAX_BYTES = 256 * 1024;

export type AttachmentPreviewSource =
	| {
			kind: 'stored';
			id: string;
			filename: string;
			mimeType: string;
			sizeBytes?: number | null;
	  }
	| {
			kind: 'local';
			file: File;
			filename: string;
			mimeType: string;
			sizeBytes: number;
	  };

type LoadedPreview = {
	blob: Blob;
	objectUrl: string;
	previewKind: AttachmentPreviewKind;
	textContent: string | null;
	textTruncated: boolean;
};

async function loadPreviewSource(
	source: AttachmentPreviewSource,
): Promise<LoadedPreview> {
	const blob =
		source.kind === 'local'
			? source.file
			: await fetchAttachmentBlob(source.id);
	const previewKind = getAttachmentPreviewKind(source.mimeType);
	const objectUrl = URL.createObjectURL(blob);

	let textContent: string | null = null;
	let textTruncated = false;

	if (previewKind === 'text') {
		const slice =
			blob.size > TEXT_PREVIEW_MAX_BYTES
				? blob.slice(0, TEXT_PREVIEW_MAX_BYTES)
				: blob;
		textContent = await slice.text();
		textTruncated = blob.size > TEXT_PREVIEW_MAX_BYTES;
	}

	return {
		blob,
		objectUrl,
		previewKind,
		textContent,
		textTruncated,
	};
}

type AttachmentPreviewDialogProps = {
	source: AttachmentPreviewSource | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

function PreviewBody({
	loaded,
	filename,
}: {
	loaded: LoadedPreview;
	filename: string;
}) {
	switch (loaded.previewKind) {
		case 'image':
			return (
				<div className="bg-muted/30 flex min-h-[40vh] items-center justify-center rounded-lg border p-4">
					<img
						src={loaded.objectUrl}
						alt={filename}
						className="max-h-[70vh] max-w-full object-contain"
					/>
				</div>
			);
		case 'text':
			return (
				<ScrollArea className="bg-muted/30 max-h-[70vh] rounded-lg border">
					<pre className="p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap wrap-break-word">
						{loaded.textContent}
					</pre>
					{loaded.textTruncated ? (
						<p className="text-muted-foreground border-t px-4 py-2 text-xs">
							Preview truncated. Download the file to view the full contents.
						</p>
					) : null}
				</ScrollArea>
			);
		case 'pdf':
			return (
				<div className="bg-muted/30 min-h-[60vh] overflow-hidden rounded-lg border">
					<iframe
						src={loaded.objectUrl}
						title={filename}
						className="h-[70vh] w-full"
					/>
				</div>
			);
		default:
			return (
				<div className="bg-muted/30 flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border p-8 text-center">
					<FileIcon className="text-muted-foreground size-10" />
					<p className="text-muted-foreground text-sm">
						Preview is not available for this file type.
					</p>
				</div>
			);
	}
}

export function AttachmentPreviewDialog({
	source,
	open,
	onOpenChange,
}: AttachmentPreviewDialogProps) {
	const [loaded, setLoaded] = useState<LoadedPreview | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [downloading, setDownloading] = useState(false);

	useEffect(() => {
		if (!open || !source) {
			setLoaded((current) => {
				if (current) {
					URL.revokeObjectURL(current.objectUrl);
				}
				return null;
			});
			setError(null);
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);
		setLoaded((current) => {
			if (current) {
				URL.revokeObjectURL(current.objectUrl);
			}
			return null;
		});

		void loadPreviewSource(source)
			.then((preview) => {
				if (cancelled) {
					URL.revokeObjectURL(preview.objectUrl);
					return;
				}
				setLoaded(preview);
			})
			.catch((err) => {
				if (!cancelled) {
					setError(getErrorMessage(err));
				}
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [open, source]);

	useEffect(() => {
		return () => {
			if (loaded) {
				URL.revokeObjectURL(loaded.objectUrl);
			}
		};
	}, [loaded]);

	const filename = source?.filename ?? 'attachment';
	const description = source
		? formatAttachmentDescription(
				source.filename,
				source.mimeType,
				source.sizeBytes,
			)
		: '';

	const handleDownload = async () => {
		if (!source) {
			return;
		}

		setDownloading(true);
		setError(null);

		try {
			if (source.kind === 'local') {
				saveLocalFile(source.file, source.filename);
				return;
			}

			await saveAttachmentFile(source.id, source.filename);
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setDownloading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={cn(
					'max-h-[calc(100vh-2rem)] overflow-hidden sm:max-w-3xl',
					loaded?.previewKind === 'image' && 'sm:max-w-4xl',
				)}
			>
				<DialogHeader>
					<DialogTitle className="truncate pr-8">{filename}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 flex-1">
					{loading ? (
						<div className="space-y-3">
							<Skeleton className="h-[50vh] w-full rounded-lg" />
						</div>
					) : error ? (
						<div className="text-destructive bg-destructive/5 rounded-lg border p-4 text-sm">
							{error}
						</div>
					) : loaded ? (
						<PreviewBody loaded={loaded} filename={filename} />
					) : null}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Close
					</Button>
					<Button
						disabled={!source || downloading}
						onClick={() => void handleDownload()}
					>
						{downloading ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Download className="size-4" />
						)}
						Download
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function toPreviewSourceFromStored(input: {
	id: string;
	filename: string;
	mimeType?: string | null;
	sizeBytes?: number | null;
}): AttachmentPreviewSource {
	return {
		kind: 'stored',
		id: input.id,
		filename: input.filename,
		mimeType: input.mimeType || 'application/octet-stream',
		sizeBytes: input.sizeBytes,
	};
}

export function toPreviewSourceFromLocal(input: {
	file: File;
	filename: string;
	mimeType: string;
	sizeBytes: number;
}): AttachmentPreviewSource {
	return {
		kind: 'local',
		file: input.file,
		filename: input.filename,
		mimeType: input.mimeType,
		sizeBytes: input.sizeBytes,
	};
}
