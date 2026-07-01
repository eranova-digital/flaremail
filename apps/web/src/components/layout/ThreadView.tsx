import { Reply } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ThreadActions } from "@/components/layout/ThreadActions";
import { useMessage, useSendDraft, useThreadMessages } from "@/hooks/use-thread";
import { isThreadFolder } from "@/lib/folders";
import { getErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

function isDraftMessage(sendStatus?: string | null): boolean {
	return sendStatus === "draft";
}

function MessageBody({
	mailboxId,
	messageId,
	isDraft,
	preview,
}: {
	mailboxId: string;
	messageId: string;
	isDraft: boolean;
	preview?: string | null;
}) {
	const messageQuery = useMessage(mailboxId, messageId);

	if (messageQuery.isLoading) {
		return <Skeleton className="h-24 w-full" />;
	}

	if (messageQuery.isError) {
		if (isDraft && preview) {
			return (
				<pre className="text-sm whitespace-pre-wrap text-muted-foreground">
					{preview}
				</pre>
			);
		}

		return (
			<p className="text-destructive text-sm">
				{getErrorMessage(messageQuery.error)}
			</p>
		);
	}

	const message = messageQuery.data;
	if (!message) {
		return null;
	}

	if (message.html) {
		return (
			<div
				className="prose prose-sm max-w-none"
				dangerouslySetInnerHTML={{ __html: message.html }}
			/>
		);
	}

	return (
		<pre className="text-sm whitespace-pre-wrap">
			{message.text || message.preview || preview || "(empty message)"}
		</pre>
	);
}

export function ThreadView() {
	const navigate = useNavigate();
	const { mailboxId, threadId } = useParams();
	const [searchParams] = useSearchParams();
	const folderParam = searchParams.get("folder") ?? "inbox";
	const folder = isThreadFolder(folderParam) ? folderParam : "inbox";
	const messagesQuery = useThreadMessages(mailboxId ?? "", threadId);
	const sendDraftMutation = useSendDraft(mailboxId ?? "", threadId);

	if (!mailboxId || !threadId) {
		return (
			<div className="text-muted-foreground flex h-full items-center justify-center p-8 text-sm">
				Select a thread to read
			</div>
		);
	}

	if (messagesQuery.isLoading) {
		return (
			<div className="space-y-4 p-6">
				<Skeleton className="h-8 w-2/3" />
				<Skeleton className="h-32 w-full" />
			</div>
		);
	}

	if (messagesQuery.isError) {
		return (
			<div className="text-destructive p-6 text-sm">
				{getErrorMessage(messagesQuery.error)}
			</div>
		);
	}

	const { thread, messages = [] } = messagesQuery.data ?? {};

	return (
		<div className="flex h-full min-w-0 flex-col">
			<div className="space-y-3 border-b p-4">
				<div className="flex items-start justify-between gap-4">
					<div className="min-w-0">
						<h2 className="truncate text-lg font-semibold">
							{thread?.subject || "(no subject)"}
						</h2>
						<p className="text-muted-foreground text-sm">
							{messages.length} message{messages.length === 1 ? "" : "s"}
						</p>
					</div>
					<ThreadActions
						mailboxId={mailboxId}
						threadId={threadId}
						folder={folder}
					/>
				</div>
			</div>
			<ScrollArea className="flex-1">
				<div className="space-y-4 p-4">
					{messages.map((message) => {
						const isDraft = isDraftMessage(message.sendStatus);

						return (
							<article
								key={message.id}
								className={cn(
									"bg-card rounded-lg border p-4 shadow-sm",
									isDraft && "border-dashed border-amber-500/50",
								)}
							>
								<div className="mb-3 flex items-start justify-between gap-3">
									<div className="min-w-0 text-sm">
										<div className="flex items-center gap-2">
											<p className="font-medium">{message.from}</p>
											{isDraft ? (
												<Badge variant="secondary">Draft</Badge>
											) : null}
										</div>
										<p className="text-muted-foreground truncate">
											To: {message.to}
										</p>
									</div>
									<div className="flex shrink-0 items-center gap-2">
										{isDraft ? (
											<span className="text-muted-foreground text-xs">
												Not sent
											</span>
										) : (
											<span className="text-muted-foreground text-xs">
												{new Date(
													message.sentAt ?? message.receivedAt ?? "",
												).toLocaleString()}
											</span>
										)}
										{isDraft ? (
											<>
												<Button
													variant="outline"
													size="sm"
													onClick={() =>
														navigate(
															`/m/${mailboxId}/compose?draftId=${message.id}&threadId=${threadId}&folder=${folder}`,
														)
													}
												>
													Edit
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
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													navigate(
														`/m/${mailboxId}/compose?replyTo=${message.id}&threadId=${threadId}&folder=${folder}`,
													)
												}
											>
												<Reply className="size-4" />
												Reply
											</Button>
										)}
									</div>
								</div>
								<Separator className="mb-3" />
								{message.id ? (
									<MessageBody
										mailboxId={mailboxId}
										messageId={message.id}
										isDraft={isDraft}
										preview={message.preview}
									/>
								) : null}
							</article>
						);
					})}
				</div>
			</ScrollArea>
		</div>
	);
}
