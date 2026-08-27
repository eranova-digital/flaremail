import { ChevronDown, Menu, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { DraftListItem } from '@/components/layout/DraftListItem';
import { useMailboxNavOptional } from '@/components/layout/MailboxNavContext';
import { ThreadListItem } from '@/components/layout/ThreadListItem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDrafts } from '@/hooks/use-drafts';
import { useLabels } from '@/hooks/use-labels';
import { useThreadsByLabel } from '@/hooks/use-threads-by-label';
import { useThreads } from '@/hooks/use-threads';
import { FOLDER_LABELS, FOLDERS, isThreadFolder } from '@/lib/folders';
import type { Thread, ThreadFolder } from '@/lib/api/client';
import { getErrorMessage } from '@/lib/api/errors';
import { DEFAULT_LABEL_COLOR } from '@/lib/label-colors';
import { composePath, threadPath } from '@/lib/mailbox-routes';
import { cn } from '@/lib/utils';

function NavMenuButton() {
	const { t } = useTranslation('mail');
	const nav = useMailboxNavOptional();
	if (!nav?.isMobile) {
		return null;
	}
	return (
		<Button
			variant="ghost"
			size="icon"
			className="size-8 shrink-0"
			aria-label={t('sidebar.open')}
			onClick={nav.openNav}
		>
			<Menu className="size-4" />
		</Button>
	);
}

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

function DraftMessageList({
	mailboxId,
}: {
	mailboxId: string;
}) {
	const { t } = useTranslation('mail');
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const draftsQuery = useDrafts(mailboxId);
	const selectedDraftId =
		searchParams.get('draftId') ?? searchParams.get('messageId');

	if (draftsQuery.isLoading) {
		return (
			<div className="space-y-2 p-3">
				{Array.from({ length: 6 }).map((_, index) => (
					<Skeleton key={index} className="h-16 w-full" />
				))}
			</div>
		);
	}

	if (draftsQuery.isError) {
		return <div className="text-destructive p-4 text-sm">{getErrorMessage(draftsQuery.error)}</div>;
	}

	const drafts = draftsQuery.data?.items ?? [];

	return (
		<>
			<div className="flex items-center justify-between gap-2 border-b px-3 py-3 sm:px-4">
				<div className="flex min-w-0 items-center gap-1">
					<NavMenuButton />
					<h2 className="truncate font-medium">{FOLDER_LABELS.drafts}</h2>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						aria-label={t('threadList.refreshDrafts')}
						disabled={draftsQuery.isFetching}
						onClick={() => void draftsQuery.refetch()}
					>
						<RefreshCw className={cn('size-4', draftsQuery.isFetching && 'animate-spin')} />
					</Button>
					<Badge variant="secondary" className="max-w-[9rem] truncate sm:max-w-none">
						{t('threadList.draftCount', { count: drafts.length })}
					</Badge>
				</div>
			</div>
			<div className="max-w-full flex-1 overflow-y-auto">
				{drafts.length === 0 ? (
					<p className="text-muted-foreground p-4 text-sm">{t('threadList.emptyDrafts')}</p>
				) : (
					<ul>
						{drafts.map((draft) => (
								<DraftListItem
									key={draft.id!}
									draft={draft}
									selected={draft.id === selectedDraftId}
									onSelect={() => {
										if (!draft.id || !draft.threadId) {
											return;
										}
										if (draft.composeOnly) {
											navigate(
												composePath(mailboxId, {
													draftId: draft.id,
													threadId: draft.threadId,
													folder: 'drafts',
												}),
											);
											return;
										}
										navigate(
											threadPath(mailboxId, draft.threadId, {
												folder: 'drafts',
												messageId: draft.id,
											}),
										);
									}}
								/>
							))}
					</ul>
				)}
			</div>
		</>
	);
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
	const { t } = useTranslation('mail');
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
	const unreadCount = threads.filter((thread) => !thread.isRead).length;

	return (
		<>
			<div className="flex items-center justify-between gap-2 border-b px-3 py-3 sm:px-4">
				<div className="flex min-w-0 items-center gap-1">
					<NavMenuButton />
					<h2 className="truncate font-medium">{FOLDER_LABELS[activeFolder]}</h2>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						aria-label={t('threadList.refresh')}
						disabled={threadsQuery.isFetching}
						onClick={() => void threadsQuery.refetch()}
					>
						<RefreshCw className={cn('size-4', threadsQuery.isFetching && 'animate-spin')} />
					</Button>
					<Badge variant="secondary" className="max-w-[9rem] truncate sm:max-w-none">
						{unreadCount > 0 ? t('threadList.unreadPrefix', { count: unreadCount }) : ''}
						{t('threadList.threadCount', { count: threads.length })}
					</Badge>
				</div>
			</div>
			<div className="max-w-full flex-1 overflow-y-auto">
				{threads.length === 0 ? (
					<p className="text-muted-foreground p-4 text-sm">
						{t('threadList.emptyFolder', { folder: FOLDER_LABELS[activeFolder] })}
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
	const { t } = useTranslation('mail');
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
					{unreadCount > 0 ? t('threadList.unreadPrefix', { count: unreadCount }) : ''}
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
							{t('threadList.emptyFolder', { folder: FOLDER_LABELS[folder] })}
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
						<p className="text-muted-foreground px-4 py-2 text-xs">{t('threadList.refreshing')}</p>
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
	const { t } = useTranslation('mail');
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
			<div className="flex items-center justify-between gap-2 border-b px-3 py-3 sm:px-4">
				<div className="flex min-w-0 items-center gap-1">
					<NavMenuButton />
					<div className="flex min-w-0 items-center gap-2">
						<span
							className="size-3 shrink-0 rounded-full"
							style={{
								backgroundColor: activeLabel?.color ?? DEFAULT_LABEL_COLOR,
							}}
						/>
						<h2 className="truncate font-medium">{activeLabel?.name ?? t('labels.fallback')}</h2>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						aria-label={t('threadList.refresh')}
						disabled={isAnyFetching}
						onClick={refetchAll}
					>
						<RefreshCw className={cn('size-4', isAnyFetching && 'animate-spin')} />
					</Button>
					<Badge variant="secondary" className="max-w-[9rem] truncate sm:max-w-none">
						{totalUnread > 0 ? t('threadList.unreadPrefix', { count: totalUnread }) : ''}
						{t('threadList.threadCount', { count: totalThreads })}
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
					<p className="text-muted-foreground p-4 text-sm">{t('threadList.emptyLabel')}</p>
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
			) : activeFolder === 'drafts' ? (
				<DraftMessageList mailboxId={mailboxId} />
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
