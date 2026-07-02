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
			reply={
				replyTo
					? { inReplyToMessageId: replyTo, threadId: threadId ?? undefined }
					: undefined
			}
			forward={forwardTo ? { messageId: forwardTo } : undefined}
			onClose={() => navigate(backTo)}
			onSent={() => {
				if (replyTo && threadId) {
					navigate(`/m/${mailboxId}/threads/${threadId}?folder=inbox`);
					return;
				}
				navigate(`/m/${mailboxId}/sent`);
			}}
		/>
	);
}
