import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { assertData } from "@/lib/api/errors";
import { forwardToMessage, sendDraft } from "@/lib/api/client";
import { ComposeSendController } from "@/lib/compose/compose-send-controller";
import { persistDraft } from "@/lib/compose/persist-draft";
import { withPendingSend } from "@/lib/compose/with-pending-send";
import { invalidateMailboxThreads } from "@/lib/invalidate-mailbox";
import type { SendResult } from "@/lib/thread-messages-cache";
import type { ComposeFields, ComposeForwardContext, ComposeReplyContext } from "./types";

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
	const [isSubmitting, setIsSubmitting] = useState(false);

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

	const contextRef = useRef({
		mailboxId,
		draftId,
		reply,
		forward,
		knownThreadId,
		selfAddress,
	});
	contextRef.current = {
		mailboxId,
		draftId,
		reply,
		forward,
		knownThreadId,
		selfAddress,
	};

	const controllerRef = useRef<ComposeSendController | null>(null);
	if (!controllerRef.current) {
		controllerRef.current = new ComposeSendController({
			get mailboxId() {
				return contextRef.current.mailboxId;
			},
			get draftId() {
				return draftIdRef.current ?? contextRef.current.draftId;
			},
			get reply() {
				return contextRef.current.reply;
			},
			get forward() {
				return contextRef.current.forward;
			},
			get knownThreadId() {
				return contextRef.current.knownThreadId;
			},
			get selfAddress() {
				return contextRef.current.selfAddress;
			},
			flushPendingSave,
			getFields: () => fieldsRef.current,
			getAttachments: () => attachmentsRef.current,
			getAttachmentsDirty: () => attachmentsDirtyRef.current,
			setDraftId: (id) => {
				draftIdRef.current = id;
				setDraftId(id);
			},
			setAttachmentsDirty: (dirty) => {
				attachmentsDirtyRef.current = dirty;
			},
			createDraft: (...args) => createMutation.mutateAsync(...args),
			updateDraft: (...args) => updateMutation.mutateAsync(...args),
			sendDraft: (id) => sendMutation.mutateAsync(id),
			forwardToMessage: (body) => forwardMutation.mutateAsync(body),
			persistDraft,
			withPendingSend: (threadId, draftId, preview, sendFn) =>
				withPendingSend(
					queryClient,
					mailboxId,
					threadId,
					draftId,
					preview,
					sendFn,
				),
		});
	}

	const send = useCallback(async (): Promise<SendResult> => {
		setIsSubmitting(true);
		sealedRef.current = true;
		try {
			return await controllerRef.current!.send();
		} catch (error) {
			sealedRef.current = false;
			throw error;
		} finally {
			setIsSubmitting(false);
		}
	}, [sealedRef]);

	return {
		send,
		isSending:
			isSubmitting || sendMutation.isPending || forwardMutation.isPending,
		sendError: sendMutation.error ?? forwardMutation.error,
	};
}
