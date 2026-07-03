import { Paperclip, Reply, ReplyAll } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ComposePane } from '@/components/compose/ComposePane';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MessageActionsMenu } from '@/components/message/MessageActionsMenu';
import { MessageAddress } from '@/components/message/MessageAddress';
import { MessageBody } from '@/components/message/MessageBody';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThreadActions } from '@/components/layout/ThreadActions';
import { useAutoThreadReadStatus } from '@/hooks/use-auto-thread-read-status';
import { useDeleteDraft, useSendDraft, useThreadMessages } from '@/hooks/use-thread';
import { useSyncOpenThreadFromList } from '@/hooks/use-sync-open-thread-from-list';
import { useMailboxes } from '@/hooks/use-mailboxes';
import { isThreadFolder } from '@/lib/folders';
import { isStructuralHtml } from '@/lib/html';
import { getErrorMessage, isNotFoundError } from '@/lib/api/errors';
import { formatSubjectForDisplay, isSubjectChange } from '@/lib/subject';
import { formatAddedCcRecipients, formatRecipientList, getNewCcRecipients, parseAddresses } from '@/lib/cc-recipients';
import type { ThreadMessagePreview } from '@/lib/api/generated';
import { usePendingSends } from '@/lib/pending-sends';
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

function formatMessageTime(value: string): string {
	return new Date(value).toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
	});
}

function formatDateSeparator(value: string): string {
	const date = new Date(value);
	const now = new Date();

	if (isSameCalendarDay(date, now)) {
		return 'Today';
	}

	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	if (isSameCalendarDay(date, yesterday)) {
		return 'Yesterday';
	}

	return date.toLocaleDateString([], {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
}

function formatExactDate(value: string): string {
	return new Date(value).toLocaleDateString([], {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
}

function PendingMessageSkeleton() {
	return (
		<div className="space-y-3" aria-busy="true" aria-label="Sending message">
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

function ThreadViewSkeleton() {
	return (
		<div className="flex h-full min-w-0 flex-col" aria-busy="true" aria-label="Loading conversation">
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

function getShortPreview(message: ThreadMessagePreview, maxLength = 48): string {
	const raw = message.preview?.trim() || message.text?.trim() || '';
	const singleLine = raw.replace(/\s+/g, ' ').trim();
	if (!singleLine) {
		return '(no preview)';
	}

	return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength)}…` : singleLine;
}

export function ThreadView() {
	const navigate = useNavigate();
	const { mailboxId, threadId } = useParams();
	const [searchParams] = useSearchParams();
	const folderParam = searchParams.get('folder') ?? 'inbox';
	const folder = isThreadFolder(folderParam) ? folderParam : 'inbox';
	const messagesQuery = useThreadMessages(mailboxId ?? '', threadId, {
		includeBody: true,
	});
	useSyncOpenThreadFromList(mailboxId ?? '', threadId, folder);
	const { thread, messages: serverMessages = [] } = messagesQuery.data ?? {};
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
	const previousMessageCountRef = useRef(0);
	const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);
	const [replyAll, setReplyAll] = useState(false);
	const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
	const [composerDraftId, setComposerDraftId] = useState<string | null>(null);

	useEffect(() => {
		previousMessageCountRef.current = 0;
		scrolledToBottomThreadIdRef.current = null;
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
	const showReplyAll = (thread?.participants?.length ?? 0) > 1;
	const mailboxesQuery = useMailboxes();
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
			requestAnimationFrame(() => {
				threadEndRef.current?.scrollIntoView({ block: 'end' });
			});
		} else if (hasNewMessages) {
			requestAnimationFrame(() => {
				threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
			});
		}

		previousMessageCountRef.current = messages.length;
	}, [threadId, messagesQuery.isLoading, messagesQuery.isError, messages.length]);

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
		return <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-sm">Select a thread to read</div>;
	}

	if (messagesQuery.isLoading) {
		return <ThreadViewSkeleton />;
	}

	if (messagesQuery.isError) {
		if (isNotFoundError(messagesQuery.error)) {
			return <Navigate to={`/m/${mailboxId}/${folder}`} replace />;
		}

		return <div className="text-destructive p-6 text-sm">{getErrorMessage(messagesQuery.error)}</div>;
	}

	return (
		<div className="flex h-full min-w-0 flex-col">
				<div className="space-y-3 border-b p-4">
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0">
							<h2 className="truncate text-lg font-semibold">{thread?.subject || '(no subject)'}</h2>
							<p className="text-muted-foreground text-sm">
								{messages.length} message{messages.length === 1 ? '' : 's'}
							</p>
						</div>
						<ThreadActions mailboxId={mailboxId} threadId={threadId} folder={folder} />
					</div>
				</div>
				<ScrollArea className="flex-1">
					<div className="space-y-4 p-4">
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
							const recipientLine = formatRecipientList(message.to, message.cc, selfAddress);

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
													{formatDateSeparator(messageDate)}
												</p>
											</TooltipTrigger>
											<TooltipContent>
												{formatExactDate(messageDate)}
											</TooltipContent>
										</Tooltip>
									) : null}
									{showSubjectChange ? (
										<Tooltip>
											<TooltipTrigger asChild>
												<p className="text-muted-foreground cursor-default text-center text-xs">
													<MessageAddress address={message.from} className="font-medium" />
													{' changed the subject to '}
													<span className="text-foreground font-medium">
														&ldquo;{formatSubjectForDisplay(message.subject)}&rdquo;
													</span>
												</p>
											</TooltipTrigger>
											<TooltipContent>
												Subject changes may appear as a new thread on the recipient&apos;s emailing application.
											</TooltipContent>
										</Tooltip>
									) : null}
									{showCcAddition ? (
										<Tooltip>
											<TooltipTrigger asChild>
												<p className="text-muted-foreground cursor-default text-center text-xs">
													<MessageAddress address={message.from} className="font-medium" />
													{' added '}
													<span className="text-foreground font-medium">
														{formatAddedCcRecipients(addedCcRecipients)}
													</span>
												</p>
											</TooltipTrigger>
											<TooltipContent>
												Use &ldquo;Reply All&rdquo; to message everyone on the CC list, including the original recipient.
											</TooltipContent>
										</Tooltip>
									) : null}
									<div className={cn('flex flex-col gap-1', isStructural ? 'items-stretch' : isOutbound ? 'items-end' : 'items-start')}>
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
													{getShortPreview(parentMessage)}
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
												isStructural ? 'w-full' : 'max-w-[85%]',
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
												<PendingMessageSkeleton />
											) : (
												<>
											<div className="mb-2 flex items-center justify-between gap-3">
												<div className="flex min-w-0 items-center gap-2 text-sm">
													<MessageAddress address={message.from} className="font-medium" />
													{isDraft ? <Badge variant="secondary">Draft</Badge> : null}
													{message.hasAttachments ? (
														<Paperclip className="text-muted-foreground size-3.5" aria-label="Has attachments" />
													) : null}												</div>
												<div className="flex shrink-0 items-center gap-1">
													<span className="text-muted-foreground text-xs">
														{isDraft ? 'Not sent' : formatMessageTime(message.sentAt ?? message.receivedAt ?? '')}
													</span>
													{isDraft ? (
														<>
															<Button
																variant="ghost"
																size="sm"
																onClick={() =>
																	navigate(`/m/${mailboxId}/compose?draftId=${message.id}&threadId=${threadId}&folder=${folder}`)
																}
															>
																Edit
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

																	if (!window.confirm('Delete this draft permanently?')) {
																		return;
																	}

																	deleteDraftMutation.mutate(message.id);
																}}
															>
																Delete
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
																Send
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
																		aria-label="Reply"
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
																			aria-label="Reply all"
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
																<MessageActionsMenu messageId={message.id} mailboxId={mailboxId} threadId={threadId!} folder={folder} />
															) : null}
														</>
													)}
												</div>
											</div>
											{recipientLine ? (
												<p className="text-muted-foreground mb-2 truncate text-xs">
													to: {recipientLine}
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
									</div>
								</Fragment>
							);
						})}
						{replyContext ? (
							<div ref={replyComposerRef}>
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
							<div className="flex gap-2">
								<Button
									variant="outline"
									className={showReplyAll ? 'flex-1' : 'w-full'}
									onClick={() => openReply(lastReplyableMessageId, false)}
								>
									<Reply className="size-4" />
									Reply
								</Button>
								{showReplyAll ? (
									<Button variant="outline" className="flex-1" onClick={() => openReply(lastReplyableMessageId, true)}>
										<ReplyAll className="size-4" />
										Reply all
									</Button>
								) : null}
							</div>
						) : null}
						<div ref={threadEndRef} aria-hidden className="h-px shrink-0" />
					</div>
				</ScrollArea>
			</div>
	);
}
