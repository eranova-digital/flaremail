import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api/errors";
import { fetchRawMessageText, saveRawMessageFile } from "@/lib/raw-message";
import { queryKeys } from "@/lib/query-keys";

type MessageOriginalDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	messageId: string;
	mailboxId: string;
};

export function MessageOriginalDialog({
	open,
	onOpenChange,
	messageId,
	mailboxId,
}: MessageOriginalDialogProps) {
	const [downloading, setDownloading] = useState(false);
	const [downloadError, setDownloadError] = useState<string | null>(null);

	const rawMessageQuery = useQuery({
		queryKey: queryKeys.rawMessage(mailboxId, messageId),
		queryFn: () => fetchRawMessageText(messageId, mailboxId),
		enabled: open && Boolean(messageId && mailboxId),
	});

	const handleDownload = async () => {
		setDownloading(true);
		setDownloadError(null);

		try {
			await saveRawMessageFile(messageId, mailboxId);
		} catch (error) {
			setDownloadError(getErrorMessage(error));
		} finally {
			setDownloading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Original message</DialogTitle>
					<DialogDescription>
						Raw EML source as stored for this message.
					</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-auto rounded-md border">
					{rawMessageQuery.isLoading ? (
						<div className="space-y-2 p-4">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-5/6" />
							<Skeleton className="h-4 w-4/6" />
						</div>
					) : rawMessageQuery.isError ? (
						<p className="text-destructive p-4 text-sm">
							{getErrorMessage(rawMessageQuery.error)}
						</p>
					) : (
						<pre className="p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
							{rawMessageQuery.data}
						</pre>
					)}
				</div>

				{downloadError ? (
					<p className="text-destructive text-sm">{downloadError}</p>
				) : null}

				<DialogFooter>
					<Button
						variant="outline"
						disabled={downloading || rawMessageQuery.isLoading}
						onClick={() => void handleDownload()}
					>
						{downloading ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Download className="size-4" />
						)}
						Download .eml
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
