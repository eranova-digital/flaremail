import { Star } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useThreads } from '@/hooks/use-threads';
import { FOLDER_LABELS, isThreadFolder } from '@/lib/folders';
import type { ThreadFolder } from '@/lib/api/client';
import { getErrorMessage } from '@/lib/api/errors';
import { cn } from '@/lib/utils';

function useActiveFolder(): ThreadFolder {
	const { folder } = useParams();
	const [searchParams] = useSearchParams();
	if (folder && isThreadFolder(folder)) {
		return folder;
	}
	const fromQuery = searchParams.get('folder');
	if (fromQuery && isThreadFolder(fromQuery)) {
		return fromQuery;
	}
	return 'inbox';
}

function formatWhen(value?: string | null): string {
	if (!value) {
		return '';
	}

	return new Date(value).toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
}

export function ThreadList() {
	const navigate = useNavigate();
	const { mailboxId, threadId } = useParams();
	const activeFolder = useActiveFolder();
	const threadsQuery = useThreads(mailboxId ?? '', activeFolder);

	if (!mailboxId) {
		return null;
	}

	if (threadsQuery.isLoading) {
		return (
			<div className="space-y-2 p-3">
				{Array.from({ length: 6 }).map((_, index) => (
					<Skeleton key={index} className="h-16 w-full" />
				))}
			</div>
		);
	}

	if (threadsQuery.isError) {
		return <div className="text-destructive p-4 text-sm">{getErrorMessage(threadsQuery.error)}</div>;
	}

	const threads = threadsQuery.data?.items ?? [];

	return (
		<div className="flex h-full min-w-0 max-w-md flex-col border-r">
			<div className="flex items-center justify-between border-b px-4 py-3">
				<h2 className="font-medium">{FOLDER_LABELS[activeFolder]}</h2>
				<Badge variant="secondary">{threads.length}</Badge>
			</div>
			<ScrollArea className="flex-1">
				{threads.length === 0 ? (
					<p className="text-muted-foreground p-4 text-sm">No threads in {FOLDER_LABELS[activeFolder].toLowerCase()}.</p>
				) : (
					<ul>
						{threads.map((thread) => {
							const selected = thread.id === threadId;
							const displayName =
								thread.participants?.join(", ") ||
								thread.sender ||
								"(unknown)";

							return (
								<li key={thread.id}>
									<button
										type="button"
										onClick={() =>
											navigate(
												`/m/${mailboxId}/threads/${thread.id}?folder=${activeFolder}`,
											)
										}
										className={cn(
											"hover:bg-accent/60 w-full border-b px-4 py-3 text-left transition-colors",
											selected && "bg-accent",
											!thread.isRead && "font-semibold",
										)}
									>
										<div className="flex items-start justify-between gap-2">
											<p className="truncate text-sm">{displayName}</p>
											<div className="flex shrink-0 items-center gap-1">
												{thread.isStarred ? (
													<Star className="size-3.5 fill-current text-amber-500" />
												) : null}
												<span className="text-muted-foreground text-xs whitespace-nowrap">
													{formatWhen(thread.lastMessageAt)}
												</span>
											</div>
										</div>
										<p className="text-muted-foreground mt-1 truncate text-xs">
											{thread.subject || "(no subject)"}
										</p>
										<p className="text-muted-foreground mt-1 truncate text-xs">
											{thread.preview || "No preview"}
										</p>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</ScrollArea>
		</div>
	);
}
