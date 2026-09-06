import {
	Archive,
	ChevronDown,
	FileText,
	Inbox,
	Menu,
	Pencil,
	RefreshCw,
	Search,
	Send,
	ShieldAlert,
	Tag,
	Trash2,
} from 'lucide-react';
import { useState, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { parseSearchQuery, SearchQueryError } from '@flaremail/mail-search-query';

import { DraftListItem } from '@/components/layout/DraftListItem';
import { MailSearchField } from '@/components/layout/MailSearchField';
import { useMailboxNavOptional } from '@/components/layout/MailboxNavContext';
import { ThreadListItem } from '@/components/layout/ThreadListItem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDrafts } from '@/hooks/use-drafts';
import { useLabels } from '@/hooks/use-labels';
import { useMailSearchParam } from '@/hooks/use-mail-search-param';
import { useSearch } from '@/hooks/use-search';
import { useThreadsByLabel } from '@/hooks/use-threads-by-label';
import { useThreads } from '@/hooks/use-threads';
import { FOLDER_LABELS, FOLDERS, isThreadFolder } from '@/lib/folders';
import type { MessagePreview, SearchResult, Thread, ThreadFolder } from '@/lib/api/client';
import { getErrorMessage } from '@/lib/api/errors';
import { DEFAULT_LABEL_COLOR } from '@/lib/label-colors';
import { composePath, threadPath } from '@/lib/mailbox-routes';
import { cn } from '@/lib/utils';

const FOLDER_ICONS: Record<ThreadFolder, typeof Inbox> = {
	inbox: Inbox,
	sent: Send,
	drafts: FileText,
	archived: Archive,
	trash: Trash2,
	spam: ShieldAlert,
};

function EmptyListState({
	icon: Icon,
	message,
	action,
}: {
	icon: ComponentType<{ className?: string }>;
	message: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
			<Icon className="text-muted-foreground size-8 opacity-40" aria-hidden />
			<p className="text-muted-foreground text-sm">{message}</p>
			{action}
		</div>
	);
}

function EmptyFolderHint({ folder }: { folder: ThreadFolder }) {
	const { t } = useTranslation('mail');
	const Icon = FOLDER_ICONS[folder];
	return (
		<div className="text-muted-foreground flex flex-col items-center justify-center gap-1.5 px-4 py-6 text-center">
			<Icon className="size-5 opacity-40" aria-hidden />
			<p className="text-sm">{t('threadList.emptyFolder', { folder: FOLDER_LABELS[folder] })}</p>
		</div>
	);
}

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

type MailSearchState = ReturnType<typeof useMailSearchParam>;

function MailSearchBar({ search }: { search: MailSearchState }) {
	return (
		<div className="border-b px-3 pt-0 pb-3 sm:px-4">
			<MailSearchField
				value={search.draft}
				onChange={search.setDraft}
				onSubmit={search.flush}
				onClear={search.clear}
			/>
		</div>
	);
}

function DraftMessageList({
	mailboxId,
	search,
}: {
	mailboxId: string;
	search: MailSearchState;
}) {
	const { t } = useTranslation('mail');
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const draftsQuery = useDrafts(mailboxId);
	const selectedDraftId =
		searchParams.get('draftId') ?? searchParams.get('messageId');

	const drafts = draftsQuery.data?.items ?? [];

	return (
		<>
			<div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1 sm:px-4">
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
					{!draftsQuery.isLoading && !draftsQuery.isError ? (
						<Badge variant="secondary" className="max-w-[9rem] truncate sm:max-w-none">
							{t('threadList.draftCount', { count: drafts.length })}
						</Badge>
					) : null}
				</div>
			</div>
			<MailSearchBar search={search} />
			<div className="flex min-h-0 max-w-full flex-1 flex-col overflow-y-auto">
				{draftsQuery.isLoading ? (
					<div className="space-y-2 p-3">
						{Array.from({ length: 6 }).map((_, index) => (
							<Skeleton key={index} className="h-16 w-full" />
						))}
					</div>
				) : draftsQuery.isError ? (
					<div className="text-destructive p-4 text-sm">{getErrorMessage(draftsQuery.error)}</div>
				) : drafts.length === 0 ? (
					<EmptyListState
						icon={FileText}
						message={t('threadList.emptyDrafts')}
						action={
							<Button onClick={() => navigate(composePath(mailboxId, { folder: 'drafts' }))}>
								<Pencil />
								{t('sidebar.compose')}
							</Button>
						}
					/>
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
	search,
}: {
	mailboxId: string;
	threadId?: string;
	activeFolder: ThreadFolder;
	labels: ReturnType<typeof useLabels>['data'];
	search: MailSearchState;
}) {
	const { t } = useTranslation('mail');
	const navigate = useNavigate();
	const threadsQuery = useThreads(mailboxId, activeFolder);
	const threads = threadsQuery.data?.items ?? [];
	const unreadCount = threads.filter((thread) => !thread.isRead).length;

	return (
		<>
			<div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1 sm:px-4">
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
					{!threadsQuery.isLoading && !threadsQuery.isError ? (
						<Badge variant="secondary" className="max-w-[9rem] truncate sm:max-w-none">
							{unreadCount > 0 ? t('threadList.unreadPrefix', { count: unreadCount }) : ''}
							{t('threadList.threadCount', { count: threads.length })}
						</Badge>
					) : null}
				</div>
			</div>
			<MailSearchBar search={search} />
			<div className="flex min-h-0 max-w-full flex-1 flex-col overflow-y-auto">
				{threadsQuery.isLoading ? (
					<div className="space-y-2 p-3">
						{Array.from({ length: 6 }).map((_, index) => (
							<Skeleton key={index} className="h-16 w-full" />
						))}
					</div>
				) : threadsQuery.isError ? (
					<div className="text-destructive p-4 text-sm">{getErrorMessage(threadsQuery.error)}</div>
				) : threads.length === 0 ? (
					<EmptyListState
						icon={FOLDER_ICONS[activeFolder]}
						message={t('threadList.emptyFolder', { folder: FOLDER_LABELS[activeFolder] })}
					/>
				) : (
					<ul>
						{threads.map((thread) => (
							<li key={thread.id}>
								<ThreadListItem
									thread={thread}
									selected={thread.id === threadId}
									labels={labels}
									onSelect={() =>
										navigate(threadPath(mailboxId, thread.id!, { folder: activeFolder }))
									}
								/>
							</li>
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
						<EmptyFolderHint folder={folder} />
					) : (
						<ul>
							{threads.map((thread) => (
								<li key={thread.id}>
									<ThreadListItem
										thread={thread}
										selected={thread.id === threadId}
										labels={labels}
										onSelect={() =>
											navigate(threadPath(mailboxId, thread.id!, { labelId }))
										}
									/>
								</li>
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
	search,
}: {
	mailboxId: string;
	labelId: string;
	threadId?: string;
	labels: ReturnType<typeof useLabels>['data'];
	search: MailSearchState;
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
			<div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1 sm:px-4">
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
			<MailSearchBar search={search} />
			<div className="flex min-h-0 max-w-full flex-1 flex-col overflow-y-auto">
				{isAnyLoading ? (
					<div className="space-y-2 p-3">
						{Array.from({ length: 4 }).map((_, index) => (
							<Skeleton key={index} className="h-10 w-full" />
						))}
					</div>
				) : totalThreads === 0 ? (
					<EmptyListState icon={Tag} message={t('threadList.emptyLabel')} />
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

function searchParseError(query: string): SearchQueryError | null {
	try {
		parseSearchQuery(query);
		return null;
	} catch (error) {
		return error instanceof SearchQueryError ? error : null;
	}
}

function SearchHitRow({
	hit,
	selected,
	onSelect,
}: {
	hit: MessagePreview;
	selected: boolean;
	onSelect: () => void;
}) {
	const { t, i18n } = useTranslation('mail');
	return (
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				'hover:bg-accent/70 w-full cursor-pointer px-3 py-2 text-left text-sm',
				selected && 'bg-primary/10',
			)}
		>
			<div className="flex items-baseline justify-between gap-2">
				<p className="text-muted-foreground min-w-0 truncate text-xs">{hit.from}</p>
				<span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
					{hit.receivedAt
						? new Date(hit.receivedAt).toLocaleString(i18n.language, {
								month: 'short',
								day: 'numeric',
								hour: 'numeric',
								minute: '2-digit',
							})
						: ''}
				</span>
			</div>
			<p className="truncate">
				{hit.subject || t('threadList.noSubject')}
				{hit.preview ? (
					<span className="text-muted-foreground font-normal">
						{' — '}
						{hit.preview}
					</span>
				) : null}
			</p>
		</button>
	);
}

function SearchThreadList({
	mailboxId,
	threadId,
	labelId,
	query,
	labels,
	search,
}: {
	mailboxId: string;
	threadId?: string;
	labelId?: string;
	query: string;
	labels: ReturnType<typeof useLabels>['data'];
	search: MailSearchState;
}) {
	const { t } = useTranslation('mail');
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const parseError = searchParseError(query);
	const searchQuery = useSearch(mailboxId, query);
	const selectedMessageId = searchParams.get('messageId');
	const items = searchQuery.data?.items ?? [];

	const openResult = (result: SearchResult, messageId?: string | null) => {
		const thread = result.thread;
		if (!thread.id) {
			return;
		}
		const hitId = messageId ?? result.hits[0]?.id ?? null;
		navigate(
			threadPath(mailboxId, thread.id, {
				folder: thread.folder,
				labelId,
				messageId: hitId,
				q: query,
			}),
		);
	};

	return (
		<>
			<div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1 sm:px-4">
				<div className="flex min-w-0 items-center gap-1">
					<NavMenuButton />
					<h2 className="truncate font-medium">{t('threadList.searchTitle')}</h2>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						aria-label={t('threadList.refresh')}
						disabled={searchQuery.isFetching || Boolean(parseError)}
						onClick={() => void searchQuery.refetch()}
					>
						<RefreshCw className={cn('size-4', searchQuery.isFetching && 'animate-spin')} />
					</Button>
					{!searchQuery.isLoading && !searchQuery.isError && !parseError ? (
						<Badge variant="secondary" className="max-w-[9rem] truncate sm:max-w-none">
							{t('threadList.resultCount', { count: items.length })}
						</Badge>
					) : null}
				</div>
			</div>
			<MailSearchBar search={search} />
			<div className="flex min-h-0 max-w-full flex-1 flex-col overflow-y-auto">
				{parseError ? (
					<div className="text-destructive p-4 text-sm">
						{t(parseError.code, { ns: 'errors' })}
					</div>
				) : searchQuery.isLoading ? (
					<div className="space-y-2 p-3">
						{Array.from({ length: 6 }).map((_, index) => (
							<Skeleton key={index} className="h-16 w-full" />
						))}
					</div>
				) : searchQuery.isError ? (
					<div className="text-destructive p-4 text-sm">{getErrorMessage(searchQuery.error)}</div>
				) : items.length === 0 ? (
					<EmptyListState icon={Search} message={t('threadList.emptySearch')} />
				) : (
					<ul>
						{items.map((result) => {
							const thread = result.thread;
							const hits = result.hits;
							const showNestedHits =
								hits.length > 0 && (thread.messageCount ?? 0) > 1;
							return (
								<li key={thread.id} className="border-b">
									<ThreadListItem
										thread={thread}
										selected={
											thread.id === threadId &&
											(!showNestedHits || !selectedMessageId)
										}
										labels={labels}
										onSelect={() => openResult(result)}
										bordered={false}
									/>
									{showNestedHits ? (
										<div className="border-border/70 bg-muted/40 mx-3 mb-2 ml-16 overflow-hidden rounded-md border">
											<p className="text-muted-foreground px-3 pt-2 pb-1 text-[10px] font-medium tracking-wide uppercase">
												{t('threadList.hitCount', { count: hits.length })}
											</p>
											<ul>
												{hits.map((hit, index) => (
													<li
														key={hit.id}
														className={cn(index > 0 && 'border-border/60 border-t')}
													>
														<SearchHitRow
															hit={hit}
															selected={
																thread.id === threadId && selectedMessageId === hit.id
															}
															onSelect={() => openResult(result, hit.id)}
														/>
													</li>
												))}
											</ul>
										</div>
									) : null}
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</>
	);
}

export function ThreadList() {
	const { mailboxId, threadId, labelId } = useParams();
	const activeFolder = useActiveFolder();
	const labelsQuery = useLabels(mailboxId ?? '');
	const search = useMailSearchParam();
	const searching = search.q.trim().length > 0;

	if (!mailboxId) {
		return null;
	}

	return (
		<div className="flex h-full w-full flex-col">
			{searching ? (
				<SearchThreadList
					mailboxId={mailboxId}
					threadId={threadId}
					labelId={labelId}
					query={search.q}
					labels={labelsQuery.data}
					search={search}
				/>
			) : labelId ? (
				<LabelThreadList
					mailboxId={mailboxId}
					labelId={labelId}
					threadId={threadId}
					labels={labelsQuery.data}
					search={search}
				/>
			) : activeFolder === 'drafts' ? (
				<DraftMessageList mailboxId={mailboxId} search={search} />
			) : (
				<FolderThreadList
					mailboxId={mailboxId}
					threadId={threadId}
					activeFolder={activeFolder}
					labels={labelsQuery.data}
					search={search}
				/>
			)}
		</div>
	);
}
