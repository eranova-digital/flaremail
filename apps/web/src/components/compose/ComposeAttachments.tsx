import { Download, FileIcon, Paperclip, X } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent } from 'react';

import {
	AttachmentPreviewDialog,
	toPreviewSourceFromLocal,
	toPreviewSourceFromStored,
	type AttachmentPreviewSource,
} from '@/components/attachment/AttachmentPreviewDialog';
import {
	Attachment,
	AttachmentAction,
	AttachmentActions,
	AttachmentContent,
	AttachmentDescription,
	AttachmentGroup,
	AttachmentMedia,
	AttachmentTitle,
	AttachmentTrigger,
} from '@/components/ui/attachment';
import { Button } from '@/components/ui/button';
import type { ComposeAttachment } from '@/lib/compose-attachments';
import { createLocalAttachment } from '@/lib/compose-attachments';
import {
	formatAttachmentDescription,
	isImageMimeType,
} from '@/lib/format-attachment';
import { fetchAttachmentBlob, saveAttachmentFile, saveLocalFile } from '@/lib/attachments';
import { getErrorMessage } from '@/lib/api/errors';

type ComposeAttachmentsProps = {
	attachments: ComposeAttachment[];
	onChange: (attachments: ComposeAttachment[]) => void;
	disabled?: boolean;
};

function LocalImagePreview({ file, alt }: { file: File; alt: string }) {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	useEffect(() => {
		const objectUrl = URL.createObjectURL(file);
		setPreviewUrl(objectUrl);
		return () => URL.revokeObjectURL(objectUrl);
	}, [file]);

	if (!previewUrl) {
		return <div className="bg-muted size-full animate-pulse" />;
	}

	return <img src={previewUrl} alt={alt} />;
}

// Once an attachment is autosaved it becomes a "stored" attachment with no local
// File, so the object-URL preview above no longer applies. Fetch the stored blob
// and render it as a thumbnail so the preview doesn't disappear after "draft
// saved". Falls back to a file icon if the fetch fails.
function StoredImagePreview({ id, alt }: { id: string; alt: string }) {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		let objectUrl: string | null = null;

		void (async () => {
			try {
				const blob = await fetchAttachmentBlob(id);
				if (cancelled) {
					return;
				}
				objectUrl = URL.createObjectURL(blob);
				setPreviewUrl(objectUrl);
			} catch {
				if (!cancelled) {
					setFailed(true);
				}
			}
		})();

		return () => {
			cancelled = true;
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
		};
	}, [id]);

	if (failed) {
		return <FileIcon />;
	}

	if (!previewUrl) {
		return <div className="bg-muted size-full animate-pulse" />;
	}

	return <img src={previewUrl} alt={alt} />;
}

function toComposePreviewSource(attachment: ComposeAttachment): AttachmentPreviewSource {
	if (attachment.kind === 'local') {
		return toPreviewSourceFromLocal({
			file: attachment.file,
			filename: attachment.filename,
			mimeType: attachment.mimeType,
			sizeBytes: attachment.sizeBytes,
		});
	}

	return toPreviewSourceFromStored({
		id: attachment.id,
		filename: attachment.filename,
		mimeType: attachment.mimeType,
		sizeBytes: attachment.sizeBytes,
	});
}

function ComposeAttachmentCard({
	attachment,
	disabled,
	onRemove,
}: {
	attachment: ComposeAttachment;
	disabled: boolean;
	onRemove: () => void;
}) {
	const [previewOpen, setPreviewOpen] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const isImage = isImageMimeType(attachment.mimeType);
	const description = formatAttachmentDescription(
		attachment.filename,
		attachment.mimeType,
		attachment.sizeBytes,
	);
	const previewSource = toComposePreviewSource(attachment);

	const handleDownload = async (event: MouseEvent) => {
		event.stopPropagation();
		setDownloading(true);
		setError(null);

		try {
			if (attachment.kind === 'local') {
				saveLocalFile(attachment.file, attachment.filename);
				return;
			}

			await saveAttachmentFile(attachment.id, attachment.filename);
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setDownloading(false);
		}
	};

	return (
		<>
			<Attachment
				state={error ? 'error' : attachment.kind === 'local' ? 'idle' : 'done'}
				orientation={isImage ? 'vertical' : 'horizontal'}
				className={isImage ? 'w-30' : undefined}
			>
				<AttachmentMedia variant={isImage ? 'image' : 'icon'}>
					{isImage ? (
						attachment.kind === 'local' ? (
							<LocalImagePreview file={attachment.file} alt={attachment.filename} />
						) : (
							<StoredImagePreview id={attachment.id} alt={attachment.filename} />
						)
					) : (
						<FileIcon />
					)}
				</AttachmentMedia>
				<AttachmentContent>
					<AttachmentTitle>{attachment.filename}</AttachmentTitle>
					<AttachmentDescription>{error ?? description}</AttachmentDescription>
				</AttachmentContent>
				<AttachmentActions>
					<AttachmentAction
						aria-label={`Download ${attachment.filename}`}
						disabled={disabled || downloading}
						onClick={(event) => void handleDownload(event)}
					>
						<Download className="size-3.5" />
					</AttachmentAction>
					<AttachmentAction
						aria-label={`Remove ${attachment.filename}`}
						disabled={disabled}
						onClick={(event) => {
							event.stopPropagation();
							onRemove();
						}}
					>
						<X className="size-3.5" />
					</AttachmentAction>
				</AttachmentActions>
				<AttachmentTrigger
					aria-label={`Preview ${attachment.filename}`}
					disabled={disabled}
					onClick={() => setPreviewOpen(true)}
				/>
			</Attachment>
			<AttachmentPreviewDialog
				source={previewSource}
				open={previewOpen}
				onOpenChange={setPreviewOpen}
			/>
		</>
	);
}

export function ComposeAttachments({
	attachments,
	onChange,
	disabled = false,
}: ComposeAttachmentsProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	const handleFilesSelected = (files: FileList | null) => {
		if (!files?.length) {
			return;
		}

		const next = [
			...attachments,
			...Array.from(files).map((file) => createLocalAttachment(file)),
		];
		onChange(next);

		if (inputRef.current) {
			inputRef.current.value = '';
		}
	};

	const removeAttachment = (key: string) => {
		onChange(attachments.filter((attachment) => attachment.key !== key));
	};

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-3">
				<label className="text-sm font-medium">Attachments</label>
				<div>
					<input
						ref={inputRef}
						type="file"
						multiple
						className="hidden"
						disabled={disabled}
						onChange={(event) => handleFilesSelected(event.target.files)}
					/>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={disabled}
						onClick={() => inputRef.current?.click()}
					>
						<Paperclip className="size-4" />
						Add files
					</Button>
				</div>
			</div>

			{attachments.length > 0 ? (
				<AttachmentGroup>
					{attachments.map((attachment) => (
						<ComposeAttachmentCard
							key={attachment.key}
							attachment={attachment}
							disabled={disabled}
							onRemove={() => removeAttachment(attachment.key)}
						/>
					))}
				</AttachmentGroup>
			) : (
				<p className="text-muted-foreground text-sm">No attachments added.</p>
			)}
		</div>
	);
}
