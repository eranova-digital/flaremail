import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { ComposePane } from "@/components/compose/ComposePane";

export function ComposePage() {
	const navigate = useNavigate();
	const { mailboxId } = useParams();
	const [searchParams] = useSearchParams();

	const replyTo = searchParams.get("replyTo") ?? undefined;
	const forwardTo = searchParams.get("forward") ?? undefined;
	const draftId = searchParams.get("draftId") ?? undefined;
	const threadId = searchParams.get("threadId") ?? undefined;
	const folder = searchParams.get("folder") ?? "inbox";

	if (!mailboxId) {
		return null;
	}

	const backTo =
		draftId && threadId
			? `/m/${mailboxId}/threads/${threadId}?folder=${folder}`
			: replyTo && threadId
				? `/m/${mailboxId}/threads/${threadId}?folder=${folder}`
				: forwardTo && threadId
					? `/m/${mailboxId}/threads/${threadId}?folder=${folder}`
					: `/m/${mailboxId}/${folder}`;

	return (
		<ComposePane
			mailboxId={mailboxId}
			existingDraftId={draftId}
			threadId={threadId}
			reply={
				replyTo
					? { inReplyToMessageId: replyTo, threadId: threadId ?? undefined }
					: undefined
			}
			forward={forwardTo ? { messageId: forwardTo } : undefined}
			onClose={() => navigate(backTo)}
			onDeleted={() => navigate(backTo)}
			onSent={(result) => {
				const sentThreadId = result.threadId ?? threadId;
				if (sentThreadId) {
					navigate(
						`/m/${mailboxId}/threads/${sentThreadId}?folder=${replyTo || forwardTo ? "inbox" : "sent"}`,
					);
					return;
				}
				navigate(`/m/${mailboxId}/sent`);
			}}
		/>
	);
}
