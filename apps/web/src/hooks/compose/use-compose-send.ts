import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { assertData } from "@/lib/api/errors";
import { forwardToMessage, sendDraft } from "@/lib/api/client";
import { composeAttachmentsToOutbound } from "@/lib/compose-attachments";
import { isEmptyEditorHtml } from "@/lib/compose-body";
import { persistDraft } from "@/lib/compose/persist-draft";
import { withPendingSend } from "@/lib/compose/with-pending-send";
import { invalidateMailboxThreads } from "@/lib/invalidate-mailbox";
import type { SendResult } from "@/lib/thread-messages-cache";
import {
	hasComposeRecipient,
	hasComposeSubject,
	parseRecipients,
	type ComposeFields,
	type ComposeForwardContext,
	type ComposeReplyContext,
} from "./types";

export function useComposeSend({
	mailboxId,
	draftId,
	draftIdRef,
	setDraftId,
	fieldsRef,
	attachmentsRef,
	attachmentsDirtyRef,
	reply,
	forward,
	threadId,
	selfAddress,
	createMutation,
	updateMutation,
	flushPendingSave,
	sealedRef,
}: {
	mailboxId: string;
	draftId: string | null;
	draftIdRef: React.MutableRefObject<string | null>;
	setDraftId: (id: string | null) => void;
	fieldsRef: React.MutableRefObject<ComposeFields>;
	attachmentsRef: React.MutableRefObject<import("@/lib/compose-attachments").ComposeAttachment[]>;
	attachmentsDirtyRef: React.MutableRefObject<boolean>;
	reply?: ComposeReplyContext;
	forward?: ComposeForwardContext;
	threadId?: string;
	selfAddress?: string | null;
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
	flushPendingSave: () => Promise<void>;
	sealedRef: React.MutableRefObject<boolean>;
}) {
	const queryClient = useQueryClient();
	const knownThreadId = reply?.threadId ?? threadId;

	// Tracks the whole send operation, not just the network mutation. The button
	// must enter its loading state immediately on click — before the awaited
	// autosave flush and attachment encoding that precede the mutation — so a
	// user can't fire multiple sends in that window. The ref guards synchronously
	// against a double-click landing before React re-renders the disabled button.
	const [isSubmitting, setIsSubmitting] = useState(false);
	const isSubmittingRef = useRef(false);

	const sendMutation = useMutation({
		mutationFn: async (id: string) => {
			const { data } = await sendDraft({
				throwOnError: true,
				path: { id },
			});
			return assertData(data, "sendDraft");
		},
		onSuccess: (data) => {
			invalidateMailboxThreads(
				queryClient,
				mailboxId,
				data.threadId ?? knownThreadId,
			);
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
		onSuccess: (data) => {
			invalidateMailboxThreads(queryClient, mailboxId, data.threadId);
		},
	});

	const runSend = useCallback(async (): Promise<SendResult> => {
		if (forward) {
			const current = fieldsRef.current;
			if (!hasComposeSubject(current)) {
				throw new Error("Subject is required");
			}
			const recipients = parseRecipients(current.to);
			if (recipients.length === 0) {
				throw new Error("Recipient is required");
			}

			const outboundAttachments = await composeAttachmentsToOutbound(
				attachmentsRef.current,
			);

			return forwardMutation.mutateAsync({
				messageId: forward.messageId,
				payload: {
					mailboxId,
					to: recipients,
					cc: parseRecipients(current.cc),
					bcc: parseRecipients(current.bcc),
					subject: current.subject || undefined,
					text: current.body,
					html: isEmptyEditorHtml(current.bodyHtml)
						? undefined
						: current.bodyHtml,
					attachments: outboundAttachments,
					includeAttachments: true,
					includeQuotedBody: true,
				},
			});
		}

		// Wait for any in-flight autosave to finish so we never issue a draft
		// update concurrently with the autosave. Concurrent updates rewrite the
		// draft's stored attachments and can leave the send unable to find the
		// attachment content it just referenced.
		await flushPendingSave();

		const current = fieldsRef.current;
		if (!hasComposeSubject(current)) {
			throw new Error("Subject is required");
		}
		if (!reply && !hasComposeRecipient(current)) {
			throw new Error("Recipient is required");
		}
		const currentAttachments = attachmentsRef.current;

		const persistResult = await persistDraft({
			mailboxId,
			draftId: draftIdRef.current ?? draftId,
			fields: current,
			attachments: currentAttachments,
			attachmentsDirty: attachmentsDirtyRef.current,
			reply,
			createDraft: createMutation.mutateAsync,
			updateDraft: updateMutation.mutateAsync,
		});

		if (!persistResult.ok) {
			throw new Error(persistResult.error);
		}

		const id = persistResult.draftId;
		draftIdRef.current = id;
		setDraftId(id);
		attachmentsDirtyRef.current = persistResult.attachmentsDirty;

		return withPendingSend(
			queryClient,
			mailboxId,
			knownThreadId,
			id,
			{
				selfAddress: selfAddress ?? null,
				to: current.to,
				inReplyToMessageId: reply?.inReplyToMessageId,
				hasAttachments: currentAttachments.length > 0,
			},
			() => sendMutation.mutateAsync(id),
		);
	}, [
		flushPendingSave,
		createMutation,
		updateMutation,
		sendMutation,
		forwardMutation,
		draftId,
		draftIdRef,
		mailboxId,
		reply,
		forward,
		knownThreadId,
		selfAddress,
		fieldsRef,
		attachmentsRef,
		attachmentsDirtyRef,
		setDraftId,
		queryClient,
	]);

	const send = useCallback(async (): Promise<SendResult> => {
		if (isSubmittingRef.current) {
			throw new Error("Send already in progress");
		}

		isSubmittingRef.current = true;
		setIsSubmitting(true);
		// Seal immediately so no autosave races the send or fires after the draft
		// has been promoted to a sent message. Unseal only if the send fails, so
		// the user can keep editing and retry.
		sealedRef.current = true;
		try {
			return await runSend();
		} catch (error) {
			sealedRef.current = false;
			throw error;
		} finally {
			isSubmittingRef.current = false;
			setIsSubmitting(false);
		}
	}, [runSend, sealedRef]);

	return {
		send,
		isSending:
			isSubmitting || sendMutation.isPending || forwardMutation.isPending,
		sendError: sendMutation.error ?? forwardMutation.error,
	};
}
