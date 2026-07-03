import { ChevronDown, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ThreadListItem } from '@/components/layout/ThreadListItem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLabels } from '@/hooks/use-labels';
import { useThreadsByLabel } from '@/hooks/use-threads-by-label';
import { useThreads } from '@/hooks/use-threads';
import { FOLDER_LABELS, FOLDERS, isThreadFolder } from '@/lib/folders';
import type { Thread, ThreadFolder } from '@/lib/api/client';
import { getErrorMessage } from '@/lib/api/errors';
import { DEFAULT_LABEL_COLOR } from '@/lib/label-colors';
import { threadPath } from '@/lib/mailbox-routes';
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

function FolderThreadList({
	mailboxId,
	threadId,
	activeFolder,
	labels,
}: {
	mailboxId: string;
	threadId?: string;
	activeFolder: ThreadFolder;
	labels: ReturnType<typeof useLabels>['data'];
}) {
	const navigate = useNavigate();
	const threadsQuery = useThreads(mailboxId, activeFolder);

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
		<>
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
						{threads.filter((thread) => !thread.isRead).length > 0
							? `${threads.filter((thread) => !thread.isRead).length} unread /`
							: ''}{' '}
						{threads.length} {threads.length === 1 ? 'thread' : 'threads'}
					</Badge>
				</div>
			</div>
			<div className="flex-1 max-w-full overflow-y-auto">
				{threads.length === 0 ? (
					<p className="text-muted-foreground p-4 text-sm">
						No threads in {FOLDER_LABELS[activeFolder].toLowerCase()}.
					</p>
				) : (
					<ul>
						{threads.map((thread) => (
							<ThreadListItem
								key={thread.id}
								thread={thread}
								selected={thread.id === threadId}
								labels={labels}
								onSelect={() =>
									navigate(threadPath(mailboxId, thread.id!, { folder: activeFolder }))
								}
							/>
						))}
					</ul>
				)}
			</div>
		</>
	);
}

function LabelFolderSection({
	mailboxId,
	threadId,
	labelId,
	folder,
	expanded,
	onToggle,
	labels,
	threads,
	isLoading,
	isError,
	error,
	isFetching,
}: {
	mailboxId: string;
	threadId?: string;
	labelId: string;
	folder: ThreadFolder;
	expanded: boolean;
	onToggle: () => void;
	labels: ReturnType<typeof useLabels>['data'];
	threads: Thread[];
	isLoading: boolean;
	isError: boolean;
	error: unknown;
	isFetching: boolean;
}) {
	const navigate = useNavigate();
	const unreadCount = threads.filter((thread) => !thread.isRead).length;

	return (
		<div className="border-b">
			<button
				type="button"
				className="hover:bg-accent/50 flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium"
				onClick={onToggle}
				aria-expanded={expanded}
			>
				<ChevronDown
					className={cn(
						'text-muted-foreground size-4 shrink-0 transition-transform',
						!expanded && '-rotate-90',
					)}
				/>
				<span className="flex-1">{FOLDER_LABELS[folder]}</span>
				<Badge variant="secondary" className="text-xs font-normal">
					{unreadCount > 0 ? `${unreadCount} unread / ` : ''}
					{threads.length}
				</Badge>
			</button>
			{expanded ? (
				<div className="border-t">
					{isLoading ? (
						<div className="space-y-2 p-3">
							{Array.from({ length: 3 }).map((_, index) => (
								<Skeleton key={index} className="h-14 w-full" />
							))}
						</div>
					) : isError ? (
						<p className="text-destructive p-4 text-sm">{getErrorMessage(error)}</p>
					) : threads.length === 0 ? (
						<p className="text-muted-foreground px-4 py-3 text-xs">
							No threads in {FOLDER_LABELS[folder].toLowerCase()}.
						</p>
					) : (
						<ul>
							{threads.map((thread) => (
								<ThreadListItem
									key={thread.id}
									thread={thread}
									selected={thread.id === threadId}
									labels={labels}
									onSelect={() =>
									navigate(threadPath(mailboxId, thread.id!, { labelId }))
								}
								/>
							))}
						</ul>
					)}
					{isFetching && !isLoading ? (
						<p className="text-muted-foreground px-4 py-2 text-xs">Refreshing…</p>
					) : null}
				</div>
			) : null}
		</div>
	);
}

function LabelThreadList({
	mailboxId,
	labelId,
	threadId,
	labels,
}: {
	mailboxId: string;
	labelId: string;
	threadId?: string;
	labels: ReturnType<typeof useLabels>['data'];
}) {
	const folderQueries = useThreadsByLabel(mailboxId, labelId);
	const [expandedFolder, setExpandedFolder] = useState<ThreadFolder | null>('inbox');

	const activeLabel = labels?.find((label) => label.id === labelId);
	const isAnyLoading = folderQueries.some((query) => query.isLoading);
	const isAnyFetching = folderQueries.some((query) => query.isFetching);
	const totalThreads = folderQueries.reduce(
		(sum, query) => sum + (query.data?.items?.length ?? 0),
		0,
	);
	const totalUnread = folderQueries.reduce(
		(sum, query) =>
			sum + (query.data?.items?.filter((thread) => !thread.isRead).length ?? 0),
		0,
	);

	const refetchAll = () => {
		for (const query of folderQueries) {
			void query.refetch();
		}
	};

	const toggleFolder = (folder: ThreadFolder) => {
		setExpandedFolder((current) => (current === folder ? null : folder));
	};

	return (
		<>
			<div className="flex items-center justify-between border-b px-4 py-3">
				<div className="flex min-w-0 items-center gap-2">
					<span
						className="size-3 shrink-0 rounded-full"
						style={{
							backgroundColor: activeLabel?.color ?? DEFAULT_LABEL_COLOR,
						}}
					/>
					<h2 className="truncate font-medium">{activeLabel?.name ?? 'Label'}</h2>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						aria-label="Refresh threads"
						disabled={isAnyFetching}
						onClick={refetchAll}
					>
						<RefreshCw className={cn('size-4', isAnyFetching && 'animate-spin')} />
					</Button>
					<Badge variant="secondary">
						{totalUnread > 0 ? `${totalUnread} unread / ` : ''}
						{totalThreads} {totalThreads === 1 ? 'thread' : 'threads'}
					</Badge>
				</div>
			</div>
			<div className="flex-1 max-w-full overflow-y-auto">
				{isAnyLoading ? (
					<div className="space-y-2 p-3">
						{Array.from({ length: 4 }).map((_, index) => (
							<Skeleton key={index} className="h-10 w-full" />
						))}
					</div>
				) : totalThreads === 0 ? (
					<p className="text-muted-foreground p-4 text-sm">No threads with this label.</p>
				) : (
					FOLDERS.map((folder, index) => {
						const query = folderQueries[index];
						const threads = query.data?.items ?? [];
						if (!query.isLoading && threads.length === 0) {
							return null;
						}
						return (
							<LabelFolderSection
								key={folder}
								mailboxId={mailboxId}
								threadId={threadId}
								labelId={labelId}
								folder={folder}
								expanded={expandedFolder === folder}
								onToggle={() => toggleFolder(folder)}
								labels={labels}
								threads={threads}
								isLoading={query.isLoading}
								isError={query.isError}
								error={query.error}
								isFetching={query.isFetching}
							/>
						);
					})
				)}
			</div>
		</>
	);
}

export function ThreadList() {
	const { mailboxId, threadId, labelId } = useParams();
	const activeFolder = useActiveFolder();
	const labelsQuery = useLabels(mailboxId ?? '');

	if (!mailboxId) {
		return null;
	}

	return (
		<div className="flex h-full w-full flex-col">
			{labelId ? (
				<LabelThreadList
					mailboxId={mailboxId}
					labelId={labelId}
					threadId={threadId}
					labels={labelsQuery.data}
				/>
			) : (
				<FolderThreadList
					mailboxId={mailboxId}
					threadId={threadId}
					activeFolder={activeFolder}
					labels={labelsQuery.data}
				/>
			)}
		</div>
	);
}
