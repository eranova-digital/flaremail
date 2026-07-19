import { Download, FileIcon, Forward } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

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
import { Card, CardContent } from '@/components/ui/card';
import type { ForwardSource } from '@/hooks/use-compose-draft';
import type { ComposeAttachment } from '@/lib/compose-attachments';
import { saveAttachmentFile, saveLocalFile } from '@/lib/attachments';
import { getErrorMessage } from '@/lib/api/errors';
import { formatAttachmentDescription } from '@/lib/format-attachment';

function formatMessageDate(
	locale: string,
	sentAt?: string | null,
	receivedAt?: string | null,
): string | null {
	const when = sentAt ?? receivedAt;
	if (!when) {
		return null;
	}

	return new Date(when).toLocaleString(locale, {
		weekday: 'short',
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
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

function ForwardedAttachmentCard({ attachment }: { attachment: ComposeAttachment }) {
	const { t } = useTranslation('compose');
	const [previewOpen, setPreviewOpen] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [error, setError] = useState<string | null>(null);

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
			<Attachment state={error ? 'error' : 'done'}>
				<AttachmentMedia>
					<FileIcon />
				</AttachmentMedia>
				<AttachmentContent>
					<AttachmentTitle>{attachment.filename}</AttachmentTitle>
					<AttachmentDescription>
						{error ??
							formatAttachmentDescription(
								attachment.filename,
								attachment.mimeType,
								attachment.sizeBytes,
							)}
					</AttachmentDescription>
				</AttachmentContent>
				<AttachmentActions>
					<AttachmentAction
						aria-label={t('attachments.downloadAria', {
							filename: attachment.filename,
						})}
						disabled={downloading}
						onClick={(event) => void handleDownload(event)}
					>
						<Download className="size-3.5" />
					</AttachmentAction>
				</AttachmentActions>
				<AttachmentTrigger
					aria-label={t('attachments.previewAria', {
						filename: attachment.filename,
					})}
					onClick={() => setPreviewOpen(true)}
				/>
			</Attachment>
			<AttachmentPreviewDialog
				source={toComposePreviewSource(attachment)}
				open={previewOpen}
				onOpenChange={setPreviewOpen}
			/>
		</>
	);
}

type ComposeForwardSourceProps = {
	source: ForwardSource;
};

export function ComposeForwardSource({ source }: ComposeForwardSourceProps) {
	const { t, i18n } = useTranslation('compose');
	const formattedDate = formatMessageDate(
		i18n.language,
		source.sentAt,
		source.receivedAt,
	);
	const preview = source.preview?.trim();

	return (
		<Card className="bg-muted/30 gap-3 rounded-lg py-0">
			<CardContent className="space-y-3 px-4 py-3">
				<div className="flex items-start gap-3">
					<div className="bg-background text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md border">
						<Forward className="size-4" />
					</div>
					<div className="min-w-0 space-y-1">
						<p className="text-sm font-medium">{t('forward.title')}</p>
						{source.from ? (
							<p className="text-muted-foreground truncate text-sm">
								{t('forward.from', { from: source.from })}
							</p>
						) : null}
						{source.subject ? (
							<p className="truncate text-sm">{source.subject}</p>
						) : null}
						{formattedDate ? (
							<p className="text-muted-foreground text-xs">{formattedDate}</p>
						) : null}
					</div>
				</div>

				{preview ? (
					<p className="text-muted-foreground line-clamp-3 text-sm">{preview}</p>
				) : null}

				{source.attachments.length > 0 ? (
					<div className="space-y-2">
						<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
							{t('forward.attachmentsIncluded', {
								count: source.attachments.length,
							})}
						</p>
						<AttachmentGroup>
							{source.attachments.map((attachment) => (
								<ForwardedAttachmentCard key={attachment.key} attachment={attachment} />
							))}
						</AttachmentGroup>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
