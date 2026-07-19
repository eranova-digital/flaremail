import { Download, FileIcon, Loader2 } from 'lucide-react';
import { useEffect, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

import {
	AttachmentPreviewDialog,
	toPreviewSourceFromStored,
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
import type { MessageFull } from '@/lib/api/client';
import { saveAttachmentFile, fetchAttachmentBlob } from '@/lib/attachments';
import { getErrorMessage } from '@/lib/api/errors';
import {
	formatAttachmentDescription,
	isImageMimeType,
} from '@/lib/format-attachment';
import { cn } from '@/lib/utils';

type Attachment = NonNullable<MessageFull['attachments']>[number];

function AttachmentImagePreview({ attachmentId, alt }: { attachmentId: string; alt: string }) {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		let objectUrl: string | null = null;

		void (async () => {
			try {
				const blob = await fetchAttachmentBlob(attachmentId);
				if (cancelled) {
					return;
				}

				objectUrl = URL.createObjectURL(blob);
				setPreviewUrl(objectUrl);
			} catch (err) {
				if (!cancelled) {
					setError(getErrorMessage(err));
				}
			}
		})();

		return () => {
			cancelled = true;
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
		};
	}, [attachmentId]);

	if (error) {
		return <FileIcon className="size-4" />;
	}

	if (!previewUrl) {
		return <div className="bg-muted size-full animate-pulse" />;
	}

	return <img src={previewUrl} alt={alt} />;
}

function MessageAttachmentCard({ attachment }: { attachment: Attachment }) {
	const { t } = useTranslation('mail');
	const [previewOpen, setPreviewOpen] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const filename = attachment.filename?.trim() || t('attachments.fallbackName');
	const description = formatAttachmentDescription(
		filename,
		attachment.mimeType,
		attachment.sizeBytes,
	);
	const isImage = isImageMimeType(attachment.mimeType);
	const previewSource =
		attachment.id
			? toPreviewSourceFromStored({
					id: attachment.id,
					filename,
					mimeType: attachment.mimeType,
					sizeBytes: attachment.sizeBytes,
				})
			: null;

	const handleDownload = async (event: MouseEvent) => {
		event.stopPropagation();
		if (!attachment.id) {
			return;
		}

		setDownloading(true);
		setError(null);

		try {
			await saveAttachmentFile(attachment.id, filename);
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setDownloading(false);
		}
	};

	return (
		<>
			<Attachment
				state={error ? 'error' : 'done'}
				orientation={isImage ? 'vertical' : 'horizontal'}
				className={cn(isImage && 'w-30')}
			>
				<AttachmentMedia variant={isImage ? 'image' : 'icon'}>
					{isImage && attachment.id ? (
						<AttachmentImagePreview attachmentId={attachment.id} alt={filename} />
					) : (
						<FileIcon />
					)}
				</AttachmentMedia>
				<AttachmentContent>
					<AttachmentTitle>{filename}</AttachmentTitle>
					<AttachmentDescription>
						{error ?? description}
					</AttachmentDescription>
				</AttachmentContent>
				<AttachmentActions>
					<AttachmentAction
						aria-label={t('attachments.downloadAria', { filename })}
						disabled={downloading || !attachment.id}
						onClick={(event) => void handleDownload(event)}
					>
						{downloading ? (
							<Loader2 className="size-3.5 animate-spin" />
						) : (
							<Download className="size-3.5" />
						)}
					</AttachmentAction>
				</AttachmentActions>
				<AttachmentTrigger
					aria-label={t('attachments.previewAria', { filename })}
					disabled={!attachment.id}
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

export function MessageAttachments({
	attachments,
	direction,
}: {
	attachments?: MessageFull['attachments'];
	direction?: MessageFull['direction'];
}) {
	const { t } = useTranslation('mail');

	if (direction !== 'inbound' && direction !== 'outbound') {
		return null;
	}

	const items = attachments?.filter((attachment) => attachment.id) ?? [];
	if (items.length === 0) {
		return null;
	}

	// Images render as tall, portrait-oriented cards while other files render as
	// wide, horizontal cards. Mixing them in one row looks uneven, so split them
	// into separate rows (images first, then files).
	const imageItems = items.filter((attachment) =>
		isImageMimeType(attachment.mimeType),
	);
	const fileItems = items.filter(
		(attachment) => !isImageMimeType(attachment.mimeType),
	);

	return (
		<div className="mt-4 space-y-2">
			<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
				{t('attachments.count', { count: items.length })}
			</p>
			{imageItems.length > 0 ? (
				<AttachmentGroup>
					{imageItems.map((attachment) => (
						<MessageAttachmentCard key={attachment.id} attachment={attachment} />
					))}
				</AttachmentGroup>
			) : null}
			{fileItems.length > 0 ? (
				<AttachmentGroup>
					{fileItems.map((attachment) => (
						<MessageAttachmentCard key={attachment.id} attachment={attachment} />
					))}
				</AttachmentGroup>
			) : null}
		</div>
	);
}
