import { RefreshCw, Star } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
		<div className="flex h-full w-full flex-col">
			<div className="flex items-center justify-between border-b px-4 py-3">
				<h2 className="font-medium">{FOLDER_LABELS[activeFolder]}</h2>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						aria-label="Refresh threads"
						disabled={threadsQuery.isFetching}
						onClick={() => void threadsQuery.refetch()}
					>
						<RefreshCw className={cn('size-4', threadsQuery.isFetching && 'animate-spin')} />
					</Button>
					<Badge variant="secondary">
						{threads.filter((thread) => !thread.isRead).length > 0 ? `${threads.filter((thread) => !thread.isRead).length} unread /` : ''}{' '}
						{threads.length} {threads.length === 1 ? 'thread' : 'threads'}
					</Badge>
				</div>
			</div>
			<div className="flex-1 max-w-full overflow-y-auto">
				{threads.length === 0 ? (
					<p className="text-muted-foreground p-4 text-sm">No threads in {FOLDER_LABELS[activeFolder].toLowerCase()}.</p>
				) : (
					<ul>
						{threads.map((thread) => {
							const selected = thread.id === threadId;
							const displayName = thread.participants?.join(', ') || thread.sender || '(unknown)';

							return (
								<li key={thread.id}>
									<button
										type="button"
										onClick={() => navigate(`/m/${mailboxId}/threads/${thread.id}?folder=${activeFolder}`)}
										className={cn(
											'hover:bg-accent/60 cursor-pointer w-full border-b px-4 py-3 text-left transition-colors group',
											selected && 'bg-accent',
											!thread.isRead && 'font-semibold border-l-3 border-l-primary',
											thread.isStarred && 'border-l-3 border-l-amber-500',
											thread.isStarred && thread.isRead && 'border-l-3 border-l-amber-200',
										)}
									>
										<div className="flex items-start justify-between gap-2">
											<p className="truncate text-muted-foreground text-xs">{displayName}</p>
											<div className="flex shrink-0 items-center gap-1">
												{thread.isStarred ? <Star className="size-3.5 fill-current text-amber-500" /> : null}
												<span className="text-muted-foreground text-xs whitespace-nowrap">{formatWhen(thread.lastMessageAt)}</span>
											</div>
										</div>
										<p className="mt-1 truncate text-sm">{thread.subject || '(no subject)'}</p>
										<p className="text-muted-foreground mt-1 truncate text-xs origin-top scale-y-0 transform transition-all duration-300 ease-in-out group-hover:scale-y-100 h-0 group-hover:h-4 blur-xs group-hover:blur-none">
											{thread.preview || 'No preview'}
										</p>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}
