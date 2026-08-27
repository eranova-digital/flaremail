import { ArrowLeft, Paperclip, Reply, ReplyAll } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { ComposePane } from '@/components/compose/ComposePane';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { MessageActionsMenu } from '@/components/message/MessageActionsMenu';
import { MessageAddress } from '@/components/message/MessageAddress';
import { MessageBody } from '@/components/message/MessageBody';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useMailboxNavOptional } from '@/components/layout/MailboxNavContext';
import { ThreadActions } from '@/components/layout/ThreadActions';
import { SeenByAvatarGroup } from '@/components/SeenByAvatarGroup';
import { useAutoThreadReadStatus } from '@/hooks/use-auto-thread-read-status';
import { useAutoThreadSeenBy } from '@/hooks/use-auto-thread-seen-by';
import { useDeleteDraft, useSendDraft, useThreadMessages } from '@/hooks/use-thread';
import { useSyncOpenThreadFromList } from '@/hooks/use-sync-open-thread-from-list';
import { useMailboxes } from '@/hooks/use-mailboxes';
import { isThreadFolder } from '@/lib/folders';
import { isStructuralHtml } from '@/lib/html';
import { getErrorMessage, isNotFoundError } from '@/lib/api/errors';
import { formatSubjectForDisplay, isSubjectChange } from '@/lib/subject';
import { formatAddedCcRecipients, formatRecipientList, getNewCcRecipients, parseAddresses } from '@/lib/cc-recipients';
import { composePath, labelListPath } from '@/lib/mailbox-routes';
import { computeMessageDisplaySeenBy } from '@/lib/message-seen-by-display';
import type { ThreadMessagePreview } from '@/lib/api/generated';
import { usePendingSends } from '@/lib/compose/pending-sends';
import type { ProfilePicture } from '@/lib/profile-picture';
import type { SendResult } from '@/lib/thread-messages-cache';
import { cn } from '@/lib/utils';

const HIGHLIGHT_DURATION_MS = 2000;

function isDraftMessage(sendStatus?: string | null): boolean {
	return sendStatus === 'draft';
}

function isPendingSendMessage(message: Pick<ThreadMessagePreview, 'sendStatus'>): boolean {
	return message.sendStatus === 'sending';
}

function messageTimestamp(
	message: Pick<ThreadMessagePreview, 'sentAt' | 'receivedAt'>,
): string | null {
	return message.sentAt ?? message.receivedAt ?? null;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

function formatMessageTime(value: string, locale: string): string {
	return new Date(value).toLocaleTimeString(locale, {
		hour: '2-digit',
		minute: '2-digit',
	});
}

function formatDateSeparator(value: string, locale: string, today: string, yesterday: string): string {
	const date = new Date(value);
	const now = new Date();

	if (isSameCalendarDay(date, now)) {
		return today;
	}

	const yesterdayDate = new Date(now);
	yesterdayDate.setDate(now.getDate() - 1);
	if (isSameCalendarDay(date, yesterdayDate)) {
		return yesterday;
	}

	return date.toLocaleDateString(locale, {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
}

function formatExactDate(value: string, locale: string): string {
	return new Date(value).toLocaleDateString(locale, {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
}

function PendingMessageSkeleton({ label }: { label: string }) {
	return (
		<div className="space-y-3" aria-busy="true" aria-label={label}>
			<div className="flex items-center justify-between gap-3">
				<Skeleton className="h-4 w-28" />
				<Skeleton className="h-3 w-16" />
			</div>
			<div className="space-y-2">
				<Skeleton className="h-3 w-full" />
				<Skeleton className="h-3 w-[92%]" />
				<Skeleton className="h-3 w-[78%]" />
			</div>
		</div>
	);
}

function MessageCardSkeleton({
	className,
	outbound = false,
	lines = 3,
}: {
	className?: string;
	outbound?: boolean;
	lines?: number;
}) {
	const lineWidths = ['w-full', 'w-[92%]', 'w-[78%]', 'w-[60%]'];

	return (
		<div className={cn('flex', outbound ? 'justify-end' : 'justify-start')}>
			<div
				className={cn(
					'rounded-2xl border p-4',
					outbound
						? 'border-r-primary/40 rounded-tr-sm border-r-4'
						: 'border-l-muted-foreground/30 rounded-tl-sm border-l-4',
					className,
				)}
			>
				<div className="mb-2 flex items-center justify-between gap-6">
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-3 w-20" />
				</div>
				<Separator className="mb-3" />
				<div className="space-y-2">
					{Array.from({ length: lines }).map((_, index) => (
						<Skeleton key={index} className={cn('h-3', lineWidths[index] ?? 'w-full')} />
					))}
				</div>
			</div>
		</div>
	);
}

function ThreadViewSkeleton({ label }: { label: string }) {
	return (
		<div className="flex h-full min-w-0 flex-col" aria-busy="true" aria-label={label}>
			<div className="space-y-3 border-b p-4">
				<div className="flex items-start justify-between gap-4">
					<div className="min-w-0 space-y-2">
						<Skeleton className="h-6 w-64" />
						<Skeleton className="h-4 w-24" />
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<Skeleton className="size-8 rounded-md" />
						<Skeleton className="size-8 rounded-md" />
						<Skeleton className="size-8 rounded-md" />
					</div>
				</div>
			</div>
			<div className="flex-1 overflow-hidden">
				<div className="space-y-4 p-4">
					<MessageCardSkeleton className="w-[72%]" lines={3} />
					<MessageCardSkeleton className="w-[58%]" outbound lines={2} />
					<MessageCardSkeleton className="w-[78%]" lines={4} />
					<div className="flex gap-2 pt-2">
						<Skeleton className="h-9 flex-1" />
					</div>
				</div>
			</div>
		</div>
	);
}

function getShortPreview(message: ThreadMessagePreview, noPreview: string, maxLength = 48): string {
	const raw = message.preview?.trim() || message.text?.trim() || '';
	const singleLine = raw.replace(/\s+/g, ' ').trim();
	if (!singleLine) {
		return noPreview;
	}

	return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength)}…` : singleLine;
}

export function ThreadView() {
	const { t, i18n } = useTranslation('mail');
	const { t: tc } = useTranslation('common');
	const navigate = useNavigate();
	const mailboxNav = useMailboxNavOptional();
	const { mailboxId, threadId, labelId: labelIdParam } = useParams();
	const [searchParams] = useSearchParams();
	const labelId = labelIdParam ?? searchParams.get('label');
	const folderFromQuery = searchParams.get('folder');
	const folderParam = folderFromQuery ?? 'inbox';
	const folder = isThreadFolder(folderParam) ? folderParam : 'inbox';
	const highlightMessageId = searchParams.get('messageId');
	const listPath = labelId
		? labelListPath(mailboxId ?? '', labelId)
		: `/m/${mailboxId}/${folder}`;
	const mailboxesQuery = useMailboxes();
	const isSharedMailbox = useMemo(
		() =>
			(mailboxesQuery.data ?? []).some(
				(mailbox) => mailbox.id === mailboxId && mailbox.type === 'shared',
			),
		[mailboxesQuery.data, mailboxId],
	);
	const messagesQuery = useThreadMessages(mailboxId ?? '', threadId, {
		includeBody: true,
	});
	useSyncOpenThreadFromList(mailboxId ?? '', threadId, folder);
	useAutoThreadSeenBy(mailboxId ?? '', threadId, isSharedMailbox);
	const { thread, messages: serverMessages = [] } = messagesQuery.data ?? {};
	const actionFolder =
		thread?.folder && isThreadFolder(thread.folder) ? thread.folder : folder;
	useAutoThreadReadStatus(mailboxId ?? '', threadId, {
		threadIsRead: thread?.isRead,
		messages: serverMessages,
		messagesReady: !messagesQuery.isLoading && !messagesQuery.isError,
	});
	const sendDraftMutation = useSendDraft(mailboxId ?? '', threadId);
	const deleteDraftMutation = useDeleteDraft(mailboxId ?? '', threadId);
	const messageRefs = useRef<Map<string, HTMLElement>>(new Map());
	const replyComposerRef = useRef<HTMLDivElement>(null);
	const threadEndRef = useRef<HTMLDivElement>(null);
	const scrolledToBottomThreadIdRef = useRef<string | null>(null);
	const highlightedFromUrlRef = useRef<string | null>(null);
	const previousMessageCountRef = useRef(0);
	const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);
	const [replyAll, setReplyAll] = useState(false);
	const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
	const [composerDraftId, setComposerDraftId] = useState<string | null>(null);
	const [draftPendingDeleteId, setDraftPendingDeleteId] = useState<string | null>(null);

	useEffect(() => {
		previousMessageCountRef.current = 0;
		scrolledToBottomThreadIdRef.current = null;
		highlightedFromUrlRef.current = null;
		setDraftPendingDeleteId(null);
	}, [threadId]);

	useEffect(() => {
		if (!replyingToMessageId) {
			return;
		}

		replyComposerRef.current?.scrollIntoView({
			behavior: 'smooth',
			block: 'nearest',
		});
	}, [replyingToMessageId]);

	const scrollToMessage = useCallback((messageId: string) => {
		const element = messageRefs.current.get(messageId);
		if (!element) {
			return;
		}

		element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		setHighlightedMessageId(messageId);
		window.setTimeout(() => {
			setHighlightedMessageId((current) => (current === messageId ? null : current));
		}, HIGHLIGHT_DURATION_MS);
	}, []);

	const pendingSends = usePendingSends(threadId);
	const messages = useMemo(() => {
		const merged = (() => {
			if (pendingSends.length === 0) {
				return serverMessages;
			}

			const pendingIds = new Set(pendingSends.map((message) => message.id));
			const withPending = serverMessages.map((message) =>
				message.id && pendingIds.has(message.id)
					? { ...message, sendStatus: 'sending' }
					: message,
			);
			const existingIds = new Set(serverMessages.map((message) => message.id));
			for (const pending of pendingSends) {
				if (!pending.id || !existingIds.has(pending.id)) {
					withPending.push(pending);
				}
			}
			return withPending;
		})();

		// While a reply composer is open it renders (and autosaves) its own
		// draft. Hide that same draft from the thread so it doesn't appear as a
		// duplicate card above the composer. The composer clears this once it
		// closes, so the sending skeleton / sent message still shows normally.
		if (composerDraftId) {
			return merged.filter((message) => message.id !== composerDraftId);
		}
		return merged;
	}, [serverMessages, pendingSends, composerDraftId]);
	const messageDisplaySeenBy = useMemo(
		() => computeMessageDisplaySeenBy(messages),
		[messages],
	);
	const showReplyAll = (thread?.participants?.length ?? 0) > 1;
	const selfAddress = mailboxesQuery.data?.find((mailbox) => mailbox.id === mailboxId)?.address ?? null;

	useEffect(() => {
		if (!threadId || messagesQuery.isLoading || messagesQuery.isError) {
			return;
		}

		const previousCount = previousMessageCountRef.current;
		const isInitialLoad = scrolledToBottomThreadIdRef.current !== threadId;
		const hasNewMessages = messages.length > previousCount && previousCount > 0;

		if (isInitialLoad) {
			scrolledToBottomThreadIdRef.current = threadId;
			if (!highlightMessageId) {
				requestAnimationFrame(() => {
					threadEndRef.current?.scrollIntoView({ block: 'end' });
				});
			}
		} else if (hasNewMessages) {
			requestAnimationFrame(() => {
				threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
			});
		}

		previousMessageCountRef.current = messages.length;
	}, [
		threadId,
		messagesQuery.isLoading,
		messagesQuery.isError,
		messages.length,
		highlightMessageId,
	]);

	useEffect(() => {
		if (
			!highlightMessageId ||
			!threadId ||
			messagesQuery.isLoading ||
			messagesQuery.isError
		) {
			return;
		}

		const highlightKey = `${threadId}:${highlightMessageId}`;
		if (highlightedFromUrlRef.current === highlightKey) {
			return;
		}

		if (!messages.some((message) => message.id === highlightMessageId)) {
			return;
		}

		const frame = requestAnimationFrame(() => {
			const attempt = () => {
				if (!messageRefs.current.has(highlightMessageId)) {
					return false;
				}
				highlightedFromUrlRef.current = highlightKey;
				scrollToMessage(highlightMessageId);
				return true;
			};
			if (attempt()) {
				return;
			}
			requestAnimationFrame(() => {
				attempt();
			});
		});
		return () => cancelAnimationFrame(frame);
	}, [
		highlightMessageId,
		threadId,
		messages,
		messagesQuery.isLoading,
		messagesQuery.isError,
		scrollToMessage,
	]);

	const messagesById = useMemo(
		() => new Map(messages.filter((message) => message.id).map((message) => [message.id!, message])),
		[messages],
	);
	const structuralMessageIds = useMemo(() => {
		const ids = new Set<string>();
		for (const message of messages) {
			if (message.id && isStructuralHtml(message.html)) {
				ids.add(message.id);
			}
		}
		return ids;
	}, [messages]);
	const ccAdditionsByMessageId = useMemo(() => {
		const result = new Map<string, string[]>();
		const seenAddresses = new Set<string>();
		messages.forEach((message, index) => {
			if (index > 0) {
				const added = getNewCcRecipients(seenAddresses, message.cc);
				if (added.length > 0 && message.id) {
					result.set(message.id, added);
				}
			}

			for (const address of parseAddresses(message.from)) {
				seenAddresses.add(address);
			}
			for (const address of parseAddresses(message.to)) {
				seenAddresses.add(address);
			}
			for (const address of parseAddresses(message.cc)) {
				seenAddresses.add(address);
			}
		});
		return result;
	}, [messages]);
	const lastReplyableMessageId = useMemo(() => {
		for (let index = messages.length - 1; index >= 0; index -= 1) {
			const message = messages[index];
			if (message.id && !isDraftMessage(message.sendStatus) && !isPendingSendMessage(message)) {
				return message.id;
			}
		}
		return null;
	}, [messages]);
	const replyingToMessage = replyingToMessageId ? messagesById.get(replyingToMessageId) : undefined;
	const replyContext = useMemo(() => {
		if (!replyingToMessageId || !replyingToMessage) {
			return null;
		}

		return {
			inReplyToMessageId: replyingToMessageId,
			threadId,
			replyAll,
			parentMessage: {
				from: replyingToMessage.from ?? '',
				text: replyingToMessage.text,
				html: replyingToMessage.html,
				preview: replyingToMessage.preview,
				sentAt: replyingToMessage.sentAt,
				receivedAt: replyingToMessage.receivedAt,
			},
		};
	}, [replyingToMessageId, replyingToMessage, threadId, replyAll]);

	const openReply = useCallback((messageId: string, all = false) => {
		setReplyAll(all);
		setReplyingToMessageId(messageId);
	}, []);

	const closeReply = useCallback(() => {
		setReplyingToMessageId(null);
		setReplyAll(false);
	}, []);

	const handleInlineSent = useCallback((_result: SendResult) => {
		closeReply();
		requestAnimationFrame(() => {
			threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
		});
	}, [closeReply]);

	if (!mailboxId || !threadId) {
		return <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-sm">{t('threadView.selectThread')}</div>;
	}

	if (messagesQuery.isLoading) {
		return <ThreadViewSkeleton label={t('threadView.loadingConversation')} />;
	}

	if (messagesQuery.isError) {
		if (isNotFoundError(messagesQuery.error)) {
			return (
				<Navigate
					to={labelId ? labelListPath(mailboxId, labelId) : `/m/${mailboxId}/${folder}`}
					replace
				/>
			);
		}

		return <div className="text-destructive p-6 text-sm">{getErrorMessage(messagesQuery.error)}</div>;
	}

	return (
		<>
		<div className="flex h-full min-w-0 flex-col">
				<div className="space-y-3 border-b p-3 sm:p-4">
					<div className="flex items-start justify-between gap-2 sm:gap-4">
						<div className="flex min-w-0 flex-1 items-start gap-1">
							{mailboxNav?.isMobile ? (
								<Button
									variant="ghost"
									size="icon"
									className="mt-0.5 size-8 shrink-0"
									aria-label={t('threadView.backToList')}
									onClick={() => navigate(listPath)}
								>
									<ArrowLeft className="size-4" />
								</Button>
							) : null}
							<div className="min-w-0">
								<h2 className="truncate text-base font-semibold sm:text-lg">
									{thread?.subject || t('threadView.noSubject')}
								</h2>
								<p className="text-muted-foreground text-sm">
									{t('threadView.messageCount', { count: messages.length })}
								</p>
							</div>
						</div>
						<ThreadActions mailboxId={mailboxId} threadId={threadId} folder={actionFolder} />
					</div>
				</div>
				<ScrollArea className="min-h-0 min-w-0 flex-1">
					<div className="min-w-0 max-w-full space-y-4 p-3 sm:p-4">
						{messages.map((message, index) => {
							const isDraft = isDraftMessage(message.sendStatus);
							const isPendingSend = isPendingSendMessage(message);
							const isOutbound = message.direction === 'outbound';
							const isStructural = Boolean(message.id && structuralMessageIds.has(message.id));
							const previousMessage = index > 0 ? messages[index - 1] : undefined;
							const parentMessage = message.inReplyTo ? messagesById.get(message.inReplyTo) : undefined;
							const showReplyIndicator = Boolean(parentMessage && message.inReplyTo && message.inReplyTo !== previousMessage?.id);

							const showSubjectChange = Boolean(!isPendingSend && previousMessage && isSubjectChange(previousMessage.subject, message.subject));
							const addedCcRecipients = !isPendingSend && message.id ? (ccAdditionsByMessageId.get(message.id) ?? []) : [];
							const showCcAddition = addedCcRecipients.length > 0;
							const recipientLine = formatRecipientList(
								message.to,
								message.cc,
								message.bcc,
								selfAddress,
							);

							const messageDate = messageTimestamp(message);
							const previousDate = previousMessage ? messageTimestamp(previousMessage) : null;
							const showDateSeparator = Boolean(messageDate) && (
								!previousDate ||
								!isSameCalendarDay(new Date(messageDate!), new Date(previousDate))
							);

							return (
								<Fragment key={message.id}>
									{showDateSeparator && messageDate ? (
										<Tooltip>
											<TooltipTrigger asChild>
												<p className="text-muted-foreground cursor-default text-center text-xs font-medium">
													{formatDateSeparator(messageDate, i18n.language, t('threadView.today'), t('threadView.yesterday'))}
												</p>
											</TooltipTrigger>
											<TooltipContent>
												{formatExactDate(messageDate, i18n.language)}
											</TooltipContent>
										</Tooltip>
									) : null}
									{showSubjectChange ? (
										<Tooltip>
											<TooltipTrigger asChild>
												<p className="text-muted-foreground cursor-default text-center text-xs">
													<MessageAddress address={message.from} className="font-medium" />
													{' '}{t('threadView.changedSubjectTo')}{' '}
													<span className="text-foreground font-medium">
														&ldquo;{formatSubjectForDisplay(message.subject)}&rdquo;
													</span>
												</p>
											</TooltipTrigger>
											<TooltipContent>
												{t('threadView.subjectChangeTooltip')}
											</TooltipContent>
										</Tooltip>
									) : null}
									{showCcAddition ? (
										<Tooltip>
											<TooltipTrigger asChild>
												<p className="text-muted-foreground cursor-default text-center text-xs">
													<MessageAddress address={message.from} className="font-medium" />
													{' '}{t('threadView.added')}{' '}
													<span className="text-foreground font-medium">
														{formatAddedCcRecipients(addedCcRecipients)}
													</span>
												</p>
											</TooltipTrigger>
											<TooltipContent>
												{t('threadView.ccAdditionTooltip')}
											</TooltipContent>
										</Tooltip>
									) : null}
									<div
										className={cn(
											'flex flex-col gap-1',
											isOutbound
												? 'items-end'
												: isStructural
													? 'items-stretch'
													: 'items-start',
										)}
									>
										{(message as ThreadMessagePreview).sentBy ? (
											<Tooltip>
												<TooltipTrigger asChild>
													<div
														className={cn(
															'text-muted-foreground flex max-w-[85%] cursor-default items-center gap-1 text-xs',
															isOutbound ? 'mr-1 justify-end' : 'ml-1',
														)}
													>
														<span className="shrink-0">{t('threadView.sentBy')}</span>
														<span className="ring-background inline-flex shrink-0 rounded-full ring-1">
															<ProfileAvatar
																accountId={(message as ThreadMessagePreview).sentBy?.accountId ?? ''}
																seed={(message as ThreadMessagePreview).sentBy?.loginIdentifier ?? ''}
																label={
																	(message as ThreadMessagePreview).sentBy?.displayName ??
																	(message as ThreadMessagePreview).sentBy?.loginIdentifier ??
																	''
																}
																profilePicture={
																	((message as ThreadMessagePreview).sentBy?.profilePicture as
																		| ProfilePicture
																		| null
																		| undefined) ?? null
																}
																className="size-4 text-[8px]"
															/>
														</span>
														<span className="truncate">
															{(message as ThreadMessagePreview).sentBy?.displayName ??
																(message as ThreadMessagePreview).sentBy?.loginIdentifier}
														</span>
													</div>
												</TooltipTrigger>
												<TooltipContent className="max-w-xs">
													<p>{t('threadView.sentByInternal')}</p>
													<small className="text-background/80 mt-1 block">
														{t('threadView.sentByExternal', { address: selfAddress ?? message.from })}
													</small>
												</TooltipContent>
											</Tooltip>
										) : null}
										{showReplyIndicator && parentMessage ? (
											<button
												type="button"
												onClick={() => {
													if (parentMessage.id) {
														scrollToMessage(parentMessage.id);
													}
												}}
												className={cn(
													'text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted flex max-w-[80%] items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
													isOutbound ? 'mr-1' : 'ml-1',
												)}
											>
												<Reply className="size-3 shrink-0" />
												<span className="truncate">
													<MessageAddress address={parentMessage.from} className="font-medium" />
													{': '}
													{getShortPreview(parentMessage, t('threadView.noPreview'))}
												</span>
											</button>
										) : null}
										<Card
											ref={(element) => {
												if (!message.id) {
													return;
												}

												if (element) {
													messageRefs.current.set(message.id, element);
												} else {
													messageRefs.current.delete(message.id);
												}
											}}
											className={cn(
												'min-w-0 gap-0 rounded-2xl p-4 py-4 transition-all duration-500',
												isStructural ? 'w-full' : 'max-w-[min(100%,42rem)] sm:max-w-[85%]',
												isPendingSend
													? 'border-r-primary rounded-tr-sm border-r-4 opacity-80'
													: isDraft
													? 'border-dashed border-amber-500/50'
													: isOutbound
														? 'border-r-primary rounded-tr-sm border-r-4'
														: 'border-l-muted-foreground/40 rounded-tl-sm border-l-4',
												highlightedMessageId === message.id && 'ring-primary/40 ring-2',
											)}
										>
											{isPendingSend ? (
												<PendingMessageSkeleton label={t('threadView.sendingMessage')} />
											) : (
												<>
											<div className="mb-2 flex items-center justify-between gap-3">
												<div className="flex min-w-0 items-center gap-2 text-sm">
													<MessageAddress address={message.from} className="font-medium" />
													{isDraft ? <Badge variant="secondary">{t('threadView.draft')}</Badge> : null}
													{message.hasAttachments ? (
														<Paperclip
															className="text-muted-foreground size-3.5"
															aria-label={t('threadView.hasAttachments')}
														/>
													) : null}
												</div>
												<div className="flex shrink-0 items-center gap-1">
													<span className="text-muted-foreground text-xs">
														{isDraft ? t('threadView.notSent') : formatMessageTime(message.sentAt ?? message.receivedAt ?? '', i18n.language)}
													</span>
													{isDraft ? (
														<>
															<Button
																variant="ghost"
																size="sm"
																onClick={() =>
																	navigate(
																		composePath(mailboxId, {
																			draftId: message.id,
																			threadId,
																			folder: labelId ? undefined : actionFolder,
																			label: labelId ?? undefined,
																		}),
																	)
																}
															>
																{tc('edit')}
															</Button>
															<Button
																variant="ghost"
																size="sm"
																className="text-destructive hover:text-destructive"
																disabled={deleteDraftMutation.isPending}
																onClick={() => {
																	if (!message.id) {
																		return;
																	}
																	setDraftPendingDeleteId(message.id);
																}}
															>
																{tc('delete')}
															</Button>
															<Button
																size="sm"
																disabled={sendDraftMutation.isPending}
																onClick={() => {
																	if (message.id) {
																		sendDraftMutation.mutate(message.id);
																	}
																}}
															>
																{t('threadView.send')}
															</Button>
														</>
													) : (
														<>
															{message.id !== lastReplyableMessageId ? (
																<>
																	<Button
																		variant="ghost"
																		size="icon"
																		className="size-7"
																		aria-label={t('threadView.reply')}
																		onClick={() => {
																			if (message.id) {
																				openReply(message.id, false);
																			}
																		}}
																	>
																		<Reply className="size-4" />
																	</Button>
																	{showReplyAll ? (
																		<Button
																			variant="ghost"
																			size="icon"
																			className="size-7"
																			aria-label={t('threadView.replyAll')}
																			onClick={() => {
																				if (message.id) {
																					openReply(message.id, true);
																				}
																			}}
																		>
																			<ReplyAll className="size-4" />
																		</Button>
																	) : null}
																</>
															) : null}
															{message.id ? (
																<MessageActionsMenu messageId={message.id} mailboxId={mailboxId} threadId={threadId!} folder={actionFolder} />
															) : null}
														</>
													)}
												</div>
											</div>
											{recipientLine ? (
												<p className="text-muted-foreground mb-2 truncate text-xs">
													{recipientLine}
												</p>
											) : null}
											<Separator className="mb-3" />
											<MessageBody
												preview={message.preview}
												text={message.text}
												html={message.html}
												attachments={message.attachments}
												direction={message.direction}
											/>
												</>
											)}
										</Card>
										{isSharedMailbox && !isDraft && message.id ? (
											<SeenByAvatarGroup
												seenBy={messageDisplaySeenBy.get(message.id)}
												size="sm"
												className={cn('mt-1', isOutbound ? 'mr-1' : 'ml-1')}
											/>
										) : null}
									</div>
								</Fragment>
							);
						})}
						{replyContext ? (
							<div ref={replyComposerRef} className="w-full min-w-0">
								<ComposePane
									key={`${replyingToMessageId}-${replyAll ? 'all' : 'one'}`}
									variant="inline"
									mailboxId={mailboxId}
									threadId={threadId}
									reply={replyContext}
									onClose={closeReply}
									onDeleted={closeReply}
									onSent={handleInlineSent}
									onDraftIdChange={setComposerDraftId}
								/>
							</div>
						) : lastReplyableMessageId ? (
							<div className="flex flex-col gap-2 sm:flex-row">
								<Button
									variant="outline"
									className={showReplyAll ? 'w-full flex-1' : 'w-full'}
									onClick={() => openReply(lastReplyableMessageId, false)}
								>
									<Reply className="size-4" />
									{t('threadView.reply')}
								</Button>
								{showReplyAll ? (
									<Button
										variant="outline"
										className="w-full flex-1"
										onClick={() => openReply(lastReplyableMessageId, true)}
									>
										<ReplyAll className="size-4" />
										{t('threadView.replyAll')}
									</Button>
								) : null}
							</div>
						) : null}
						<div ref={threadEndRef} aria-hidden className="h-px shrink-0" />
					</div>
				</ScrollArea>
			</div>
			<ConfirmDialog
				open={draftPendingDeleteId !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDraftPendingDeleteId(null);
					}
				}}
				title={t('threadView.deleteDraftConfirm.title')}
				description={t('threadView.deleteDraftConfirm.description')}
				confirmLabel={tc('delete')}
				pending={deleteDraftMutation.isPending}
				onConfirm={() => {
					if (!draftPendingDeleteId) {
						return;
					}
					deleteDraftMutation.mutate(draftPendingDeleteId, {
						onSuccess: () => setDraftPendingDeleteId(null),
					});
				}}
			/>
		</>
	);
}
