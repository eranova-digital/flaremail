import { useCallback, useRef } from "react";

import type { ComposeAttachment } from "@/lib/compose-attachments";
import { useDeleteDraft } from "@/hooks/use-thread";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { useComposeAutosave } from "./compose/use-compose-autosave";
import { useComposeInit } from "./compose/use-compose-init";
import { useComposeSend } from "./compose/use-compose-send";
import type {
	ComposeFields,
	ComposeForwardContext,
	ComposeReplyContext,
} from "./compose/types";
import { canAutosaveCompose } from "./compose/types";

export type {
	ComposeFields,
	ComposeForwardContext,
	ComposeReplyContext,
	ForwardSource,
} from "./compose/types";

export function useComposeDraft(
	mailboxId: string,
	options?: {
		reply?: ComposeReplyContext;
		forward?: ComposeForwardContext;
		existingDraftId?: string;
		threadId?: string;
	},
) {
	const reply = options?.reply;
	const forward = options?.forward;
	const invalidationThreadId = reply?.threadId ?? options?.threadId;
	const mailboxesQuery = useMailboxes();
	const selfAddress =
		mailboxesQuery.data?.find((mailbox) => mailbox.id === mailboxId)?.address ??
		null;

	const {
		draftId,
		setDraftId,
		fields,
		setFields,
		attachments,
		setAttachments,
		forwardSource,
		initialized,
		isForwardMode,
	} = useComposeInit(mailboxId, options);

	const fieldsRef = useRef(fields);
	const attachmentsRef = useRef(attachments);
	const attachmentsDirtyRef = useRef(false);
	const draftIdRef = useRef(draftId);
	// Once a send starts succeeding the draft is promoted to a sent message.
	// Any autosave that fires afterwards would target a message that is no longer
	// a draft (the server rejects it) and its state churn can starve the router
	// navigation. Sealing stops autosaves for the rest of this composer's life.
	const sealedRef = useRef(false);
	fieldsRef.current = fields;
	attachmentsRef.current = attachments;
	draftIdRef.current = draftId;

	const {
		isSaving,
		saveError,
		scheduleSave,
		clearScheduledSave,
		flushPendingSave,
		saveNow,
		createMutation,
		updateMutation,
	} = useComposeAutosave({
		mailboxId,
		draftId,
		draftIdRef,
		setDraftId,
		fieldsRef,
		attachmentsRef,
		attachmentsDirtyRef,
		setAttachments,
		reply,
		isForwardMode,
		sealedRef,
	});

	const { send, isSending, sendError } = useComposeSend({
		mailboxId,
		draftId,
		draftIdRef,
		setDraftId,
		fieldsRef,
		attachmentsRef,
		attachmentsDirtyRef,
		reply,
		forward,
		threadId: invalidationThreadId,
		selfAddress,
		createMutation,
		updateMutation,
		flushPendingSave,
		sealedRef,
	});

	const deleteDraftMutation = useDeleteDraft(mailboxId, invalidationThreadId);

	const removeDraft = useCallback(async () => {
		if (!draftId) {
			return;
		}

		clearScheduledSave();
		await deleteDraftMutation.mutateAsync(draftId);
		setDraftId(null);
	}, [clearScheduledSave, deleteDraftMutation, draftId, setDraftId]);

	const discardDraft = useCallback(async () => {
		clearScheduledSave();
		if (draftIdRef.current) {
			await deleteDraftMutation.mutateAsync(draftIdRef.current);
			draftIdRef.current = null;
			setDraftId(null);
		}
	}, [clearScheduledSave, deleteDraftMutation, setDraftId]);

	const save = useCallback(async (): Promise<boolean> => {
		return saveNow();
	}, [saveNow]);

	const canSave = canAutosaveCompose(fields, attachments, Boolean(reply));

	const updateFields = useCallback(
		(patch: Partial<ComposeFields>) => {
			const safePatch = reply
				? (({ to: _to, ...rest }) => rest)(patch)
				: patch;

			setFields((prev) => {
				const next = { ...prev, ...safePatch };
				fieldsRef.current = next;
				return next;
			});
			scheduleSave();
		},
		[reply, scheduleSave, setFields],
	);

	const updateAttachments = useCallback(
		(next: ComposeAttachment[]) => {
			attachmentsRef.current = next;
			attachmentsDirtyRef.current = true;
			setAttachments(next);
			scheduleSave();
		},
		[scheduleSave, setAttachments],
	);

	return {
		fields,
		attachments,
		forwardSource,
		updateFields,
		updateAttachments,
		send,
		save,
		removeDraft,
		discardDraft,
		clearScheduledSave,
		isSaving,
		saveError,
		canSave,
		isSending,
		sendError,
		isDeleting: deleteDraftMutation.isPending,
		deleteError: deleteDraftMutation.error,
		initialized,
		draftId,
		isForwardMode,
	};
}
