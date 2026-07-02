import { FileIcon, Forward } from "lucide-react";

import type { ForwardSource } from "@/hooks/use-compose-draft";
import { formatFileSize } from "@/lib/format-bytes";

function formatMessageDate(
	sentAt?: string | null,
	receivedAt?: string | null,
): string | null {
	const when = sentAt ?? receivedAt;
	if (!when) {
		return null;
	}

	return new Date(when).toLocaleString(undefined, {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

type ComposeForwardSourceProps = {
	source: ForwardSource;
};

export function ComposeForwardSource({ source }: ComposeForwardSourceProps) {
	const formattedDate = formatMessageDate(source.sentAt, source.receivedAt);
	const preview = source.preview?.trim();

	return (
		<div className="bg-muted/30 space-y-3 rounded-lg border px-4 py-3">
			<div className="flex items-start gap-3">
				<div className="bg-background text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md border">
					<Forward className="size-4" />
				</div>
				<div className="min-w-0 space-y-1">
					<p className="text-sm font-medium">Forwarding this message</p>
					{source.from ? (
						<p className="text-muted-foreground truncate text-sm">
							From {source.from}
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
						{source.attachments.length} attachment
						{source.attachments.length === 1 ? "" : "s"} included
					</p>
					<ul className="space-y-2">
						{source.attachments.map((attachment) => (
							<li
								key={attachment.key}
								className="bg-background flex items-center gap-2 rounded-md border px-3 py-2"
							>
								<FileIcon className="text-muted-foreground size-4 shrink-0" />
								<div className="min-w-0">
									<p className="truncate text-sm">{attachment.filename}</p>
									<p className="text-muted-foreground text-xs">
										{formatFileSize(attachment.sizeBytes)}
									</p>
								</div>
							</li>
						))}
					</ul>
				</div>
			) : null}
		</div>
	);
}
