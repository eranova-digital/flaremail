import { useCallback, useRef } from "react";

import type { ComposeAttachment } from "@/lib/compose-attachments";
import { useComposeAutosave } from "./compose/use-compose-autosave";
import { useComposeInit } from "./compose/use-compose-init";
import { useComposeSend } from "./compose/use-compose-send";
import type {
	ComposeFields,
	ComposeForwardContext,
	ComposeReplyContext,
} from "./compose/types";

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
	},
) {
	const reply = options?.reply;
	const forward = options?.forward;

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
	fieldsRef.current = fields;
	attachmentsRef.current = attachments;

	const {
		isSaving,
		saveError,
		scheduleSave,
		clearScheduledSave,
		createMutation,
		updateMutation,
	} = useComposeAutosave({
		mailboxId,
		draftId,
		setDraftId,
		fieldsRef,
		attachmentsRef,
		attachmentsDirtyRef,
		setAttachments,
		reply,
		isForwardMode,
	});

	const { send, isSending, sendError } = useComposeSend({
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
	});

	const updateFields = useCallback(
		(patch: Partial<ComposeFields>) => {
			setFields((prev) => {
				const next = { ...prev, ...patch };
				fieldsRef.current = next;
				return next;
			});
			scheduleSave();
		},
		[scheduleSave, setFields],
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
		isSaving,
		saveError,
		isSending,
		sendError,
		initialized,
		draftId,
	};
}
