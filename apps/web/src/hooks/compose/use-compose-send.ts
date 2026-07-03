import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { assertData } from "@/lib/api/errors";
import { forwardToMessage, sendDraft } from "@/lib/api/client";
import { composeAttachmentsToOutbound } from "@/lib/compose-attachments";
import { invalidateMailboxThreads } from "@/lib/invalidate-mailbox";
import {
	addPendingSend,
	buildPendingMessage,
	removePendingSend,
} from "@/lib/pending-sends";
import { queryKeys } from "@/lib/query-keys";
import type { SendResult } from "@/lib/thread-messages-cache";
import {
	fieldsToPayload,
	hasComposeRecipient,
	hasComposeSubject,
	outboundFromFields,
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

		// Only (re)upload attachments when they have unsaved changes or when we
		// still need to create the draft. Otherwise omit them so the backend
		// preserves the already-stored attachments instead of re-downloading and
		// re-uploading them on every send.
		let id = draftIdRef.current ?? draftId;
		let outboundAttachments:
			| Awaited<ReturnType<typeof composeAttachmentsToOutbound>>
			| undefined;
		if (!id || attachmentsDirtyRef.current) {
			outboundAttachments =
				await composeAttachmentsToOutbound(currentAttachments);
		}

		if (!id) {
			const created = await createMutation.mutateAsync(
				fieldsToPayload(current, mailboxId, reply, outboundAttachments),
			);
			id = created.id ?? null;
			if (id) {
				draftIdRef.current = id;
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

		if (knownThreadId) {
			await queryClient.cancelQueries({
				queryKey: queryKeys.threadMessages(mailboxId, knownThreadId),
			});
			addPendingSend(
				knownThreadId,
				buildPendingMessage({
					draftId: id,
					selfAddress: selfAddress ?? null,
					to: current.to,
					inReplyToMessageId: reply?.inReplyToMessageId,
					hasAttachments: currentAttachments.length > 0,
				}),
			);
		}

		try {
			const result = await sendMutation.mutateAsync(id);
			if (knownThreadId) {
				await queryClient.invalidateQueries({
					queryKey: queryKeys.threadMessages(mailboxId, knownThreadId),
				});
			}
			return result;
		} finally {
			if (knownThreadId) {
				removePendingSend(knownThreadId, id);
			}
		}
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
		try {
			return await runSend();
		} finally {
			isSubmittingRef.current = false;
			setIsSubmitting(false);
		}
	}, [runSend]);

	return {
		send,
		isSending:
			isSubmitting || sendMutation.isPending || forwardMutation.isPending,
		sendError: sendMutation.error ?? forwardMutation.error,
	};
}
