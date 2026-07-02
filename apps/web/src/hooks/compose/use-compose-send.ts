import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { assertData } from "@/lib/api/errors";
import { forwardToMessage, sendDraft } from "@/lib/api/client";
import { composeAttachmentsToOutbound } from "@/lib/compose-attachments";
import { invalidateMailboxThreads } from "@/lib/invalidate-mailbox";
import {
	fieldsToPayload,
	outboundFromFields,
	parseRecipients,
	type ComposeFields,
	type ComposeForwardContext,
	type ComposeReplyContext,
} from "./types";

export function useComposeSend({
	mailboxId,
	draftId,
	setDraftId,
	fieldsRef,
	attachmentsRef,
	attachmentsDirtyRef,
	reply,
	forward,
	createMutation,
	updateMutation,
	clearScheduledSave,
}: {
	mailboxId: string;
	draftId: string | null;
	setDraftId: (id: string | null) => void;
	fieldsRef: React.MutableRefObject<ComposeFields>;
	attachmentsRef: React.MutableRefObject<import("@/lib/compose-attachments").ComposeAttachment[]>;
	attachmentsDirtyRef: React.MutableRefObject<boolean>;
	reply?: ComposeReplyContext;
	forward?: ComposeForwardContext;
	createMutation: {
		mutateAsync: (
			payload: Parameters<typeof import("@/lib/api/client").createDraft>[0]["body"],
		) => Promise<{ id?: string }>;
	};
	updateMutation: {
		mutateAsync: (args: {
			id: string;
			body: Parameters<typeof import("@/lib/api/client").updateDraft>[0]["body"];
		}) => Promise<unknown>;
	};
	clearScheduledSave: () => void;
}) {
	const queryClient = useQueryClient();

	const sendMutation = useMutation({
		mutationFn: async (id: string) => {
			const { data } = await sendDraft({
				throwOnError: true,
				path: { id },
			});
			return assertData(data, "sendDraft");
		},
		onSuccess: () => {
			invalidateMailboxThreads(queryClient, mailboxId);
		},
	});

	const forwardMutation = useMutation({
		mutationFn: async (body: {
			messageId: string;
			payload: Parameters<typeof forwardToMessage>[0]["body"];
		}) => {
			const { data } = await forwardToMessage({
				throwOnError: true,
				path: { id: body.messageId },
				body: body.payload,
			});
			return assertData(data, "forwardToMessage");
		},
		onSuccess: () => {
			invalidateMailboxThreads(queryClient, mailboxId);
		},
	});

	const send = useCallback(async () => {
		clearScheduledSave();

		const current = fieldsRef.current;
		const currentAttachments = attachmentsRef.current;
		const outboundAttachments = await composeAttachmentsToOutbound(
			currentAttachments,
		);

		if (forward) {
			const recipients = parseRecipients(current.to);
			if (recipients.length === 0) {
				throw new Error("Recipient is required");
			}

			return forwardMutation.mutateAsync({
				messageId: forward.messageId,
				payload: {
					mailboxId,
					to: recipients,
					cc: parseRecipients(current.cc),
					bcc: parseRecipients(current.bcc),
					subject: current.subject || undefined,
					text: current.body,
					attachments: outboundAttachments,
					includeAttachments: true,
					includeQuotedBody: true,
				},
			});
		}

		let id = draftId;
		if (!id) {
			const created = await createMutation.mutateAsync(
				fieldsToPayload(current, mailboxId, reply, outboundAttachments),
			);
			id = created.id ?? null;
			if (id) {
				setDraftId(id);
			}
		} else {
			await updateMutation.mutateAsync({
				id,
				body: outboundFromFields(current, outboundAttachments),
			});
		}

		if (!id) {
			throw new Error("Draft was not created");
		}

		attachmentsDirtyRef.current = false;
		return sendMutation.mutateAsync(id);
	}, [
		clearScheduledSave,
		createMutation,
		updateMutation,
		sendMutation,
		forwardMutation,
		draftId,
		mailboxId,
		reply,
		forward,
		fieldsRef,
		attachmentsRef,
		attachmentsDirtyRef,
		setDraftId,
	]);

	return {
		send,
		isSending: sendMutation.isPending || forwardMutation.isPending,
		sendError: sendMutation.error ?? forwardMutation.error,
	};
}
