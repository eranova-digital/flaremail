import { Download, FileIcon, ImageIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { MessageFull } from "@/lib/api/client";
import { saveAttachmentFile, fetchAttachmentBlob } from "@/lib/attachments";
import { getErrorMessage } from "@/lib/api/errors";
import { formatFileSize } from "@/lib/format-bytes";
import { cn } from "@/lib/utils";

type Attachment = NonNullable<MessageFull["attachments"]>[number];

function isImageMimeType(mimeType?: string): boolean {
	return Boolean(mimeType?.startsWith("image/"));
}

function AttachmentImagePreview({ attachmentId }: { attachmentId: string }) {
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
		return (
			<p className="text-destructive text-xs">{error}</p>
		);
	}

	if (!previewUrl) {
		return <SkeletonBar className="h-40 w-full max-w-md" />;
	}

	return (
		<img
			src={previewUrl}
			alt=""
			className="max-h-64 max-w-full rounded-md border object-contain"
		/>
	);
}

function SkeletonBar({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"bg-muted animate-pulse rounded-md",
				className,
			)}
		/>
	);
}

function AttachmentRow({ attachment }: { attachment: Attachment }) {
	const [downloading, setDownloading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const filename = attachment.filename?.trim() || "attachment";
	const sizeLabel = formatFileSize(attachment.sizeBytes);
	const isImage = isImageMimeType(attachment.mimeType);

	const handleDownload = async () => {
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
		<li className="bg-muted/40 rounded-md border p-3">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-start gap-2">
					{isImage ? (
						<ImageIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
					) : (
						<FileIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
					)}
					<div className="min-w-0">
						<p className="truncate text-sm font-medium">{filename}</p>
						<p className="text-muted-foreground text-xs">
							{[attachment.mimeType, sizeLabel].filter(Boolean).join(" · ")}
						</p>
						{error ? (
							<p className="text-destructive mt-1 text-xs">{error}</p>
						) : null}
					</div>
				</div>
				<Button
					variant="outline"
					size="sm"
					disabled={downloading || !attachment.id}
					onClick={() => void handleDownload()}
				>
					{downloading ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Download className="size-4" />
					)}
					Download
				</Button>
			</div>
			{isImage && attachment.id ? (
				<div className="mt-3">
					<AttachmentImagePreview attachmentId={attachment.id} />
				</div>
			) : null}
		</li>
	);
}

export function MessageAttachments({
	attachments,
	direction,
}: {
	attachments?: MessageFull["attachments"];
	direction?: MessageFull["direction"];
}) {
	if (direction !== "inbound" && direction !== "outbound") {
		return null;
	}

	const items = attachments?.filter((attachment) => attachment.id) ?? [];
	if (items.length === 0) {
		return null;
	}

	return (
		<div className="mt-4 space-y-2">
			<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
				{items.length} attachment{items.length === 1 ? "" : "s"}
			</p>
			<ul className="space-y-2">
				{items.map((attachment) => (
					<AttachmentRow key={attachment.id} attachment={attachment} />
				))}
			</ul>
		</div>
	);
}
