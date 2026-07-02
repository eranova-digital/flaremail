import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { assertData } from "@/lib/api/errors";
import {
	createDraft,
	getMessage,
	updateDraft,
	type OutboundMessageBody,
} from "@/lib/api/client";
import {
	type ComposeAttachment,
	composeAttachmentsToOutbound,
	createStoredAttachment,
} from "@/lib/compose-attachments";
import {
	AUTOSAVE_MS,
	fieldsToPayload,
	hasComposeContent,
	outboundFromFields,
	type ComposeFields,
	type ComposeReplyContext,
} from "./types";

export function useComposeAutosave({
	mailboxId,
	draftId,
	setDraftId,
	fieldsRef,
	attachmentsRef,
	attachmentsDirtyRef,
	setAttachments,
	reply,
	isForwardMode,
}: {
	mailboxId: string;
	draftId: string | null;
	setDraftId: (id: string | null) => void;
	fieldsRef: React.MutableRefObject<ComposeFields>;
	attachmentsRef: React.MutableRefObject<ComposeAttachment[]>;
	attachmentsDirtyRef: React.MutableRefObject<boolean>;
	setAttachments: (attachments: ComposeAttachment[]) => void;
	reply?: ComposeReplyContext;
	isForwardMode: boolean;
}) {
	const [saveError, setSaveError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const createMutation = useMutation({
		mutationFn: async (
			payload: Parameters<typeof createDraft>[0]["body"],
		) => {
			const { data } = await createDraft({
				throwOnError: true,
				body: payload,
			});
			return assertData(data, "createDraft");
		},
	});

	const updateMutation = useMutation({
		mutationFn: async ({
			id,
			body,
		}: {
			id: string;
			body: OutboundMessageBody;
		}) => {
			const { data } = await updateDraft({
				throwOnError: true,
				path: { id },
				body,
			});
			return assertData(data, "updateDraft");
		},
	});

	const refreshStoredAttachments = useCallback(
		async (messageId: string) => {
			const { data } = await getMessage({
				throwOnError: true,
				path: { id: messageId },
				query: { mailboxId },
			});
			const message = assertData(data, "getMessage");
			const next = (message.attachments ?? [])
				.map((attachment) => createStoredAttachment(attachment))
				.filter(
					(attachment): attachment is ComposeAttachment =>
						attachment !== null,
				);
			attachmentsRef.current = next;
			setAttachments(next);
		},
		[mailboxId, attachmentsRef, setAttachments],
	);

	const persistDraft = useCallback(async () => {
		if (isForwardMode) {
			return;
		}

		const current = fieldsRef.current;
		const currentAttachments = attachmentsRef.current;
		if (!hasComposeContent(current, currentAttachments)) {
			return;
		}

		setIsSaving(true);
		setSaveError(null);

		try {
			let outboundAttachments: OutboundMessageBody["attachments"] | undefined;
			if (!draftId || attachmentsDirtyRef.current) {
				outboundAttachments = await composeAttachmentsToOutbound(
					currentAttachments,
				);
			}

			if (!draftId) {
				const created = await createMutation.mutateAsync(
					fieldsToPayload(
						current,
						mailboxId,
						reply,
						outboundAttachments,
					),
				);
				if (created.id) {
					setDraftId(created.id);
					if (outboundAttachments !== undefined) {
						await refreshStoredAttachments(created.id);
					}
				}
			} else {
				await updateMutation.mutateAsync({
					id: draftId,
					body: outboundFromFields(current, outboundAttachments),
				});
				if (outboundAttachments !== undefined) {
					await refreshStoredAttachments(draftId);
				}
			}

			attachmentsDirtyRef.current = false;
		} catch (error) {
			setSaveError(
				error instanceof Error ? error.message : "Failed to save draft",
			);
		} finally {
			setIsSaving(false);
		}
	}, [
		createMutation,
		updateMutation,
		draftId,
		mailboxId,
		reply,
		refreshStoredAttachments,
		isForwardMode,
		fieldsRef,
		attachmentsRef,
		attachmentsDirtyRef,
		setDraftId,
		setAttachments,
	]);

	const scheduleSave = useCallback(() => {
		if (isForwardMode) {
			return;
		}

		if (timerRef.current) {
			clearTimeout(timerRef.current);
		}

		timerRef.current = setTimeout(() => {
			void persistDraft();
		}, AUTOSAVE_MS);
	}, [persistDraft, isForwardMode]);

	const clearScheduledSave = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
		}
	}, []);

	useEffect(() => {
		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
		};
	}, []);

	return {
		isSaving,
		saveError,
		scheduleSave,
		clearScheduledSave,
		createMutation,
		updateMutation,
	};
}
