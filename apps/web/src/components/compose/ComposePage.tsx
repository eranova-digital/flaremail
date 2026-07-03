import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { ComposePane } from "@/components/compose/ComposePane";
import { isThreadFolder } from "@/lib/folders";
import { labelListPath, threadPath } from "@/lib/mailbox-routes";

export function ComposePage() {
	const navigate = useNavigate();
	const { mailboxId } = useParams();
	const [searchParams] = useSearchParams();

	const replyTo = searchParams.get("replyTo") ?? undefined;
	const forwardTo = searchParams.get("forward") ?? undefined;
	const draftId = searchParams.get("draftId") ?? undefined;
	const threadId = searchParams.get("threadId") ?? undefined;
	const folderParam = searchParams.get("folder") ?? "inbox";
	const folder = isThreadFolder(folderParam) ? folderParam : "inbox";
	const labelId = searchParams.get("label") ?? undefined;

	if (!mailboxId) {
		return null;
	}

	const backTo =
		draftId && threadId
			? threadPath(mailboxId, threadId, { folder, labelId })
			: replyTo && threadId
				? threadPath(mailboxId, threadId, { folder, labelId })
				: forwardTo && threadId
					? threadPath(mailboxId, threadId, { folder, labelId })
					: labelId
						? labelListPath(mailboxId, labelId)
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
						threadPath(mailboxId, sentThreadId, {
							folder: replyTo || forwardTo ? "inbox" : "sent",
							labelId,
						}),
					);
					return;
				}
				navigate(labelId ? labelListPath(mailboxId, labelId) : `/m/${mailboxId}/sent`);
			}}
		/>
	);
}
