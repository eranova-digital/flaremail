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
	createStoredAttachment,
} from "@/lib/compose-attachments";
import { persistDraft } from "@/lib/compose/persist-draft";
import type { ComposeSession } from "@/lib/compose/compose-session";
import {
	AUTOSAVE_MS,
	canAutosaveCompose,
	getSaveBlockedReason,
	type ComposeFields,
	type ComposeReplyContext,
} from "./types";

export function useComposeAutosave({
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
	session,
}: {
	mailboxId: string;
	draftId: string | null;
	draftIdRef: React.MutableRefObject<string | null>;
	setDraftId: (id: string | null) => void;
	fieldsRef: React.MutableRefObject<ComposeFields>;
	attachmentsRef: React.MutableRefObject<ComposeAttachment[]>;
	attachmentsDirtyRef: React.MutableRefObject<boolean>;
	setAttachments: (attachments: ComposeAttachment[]) => void;
	reply?: ComposeReplyContext;
	isForwardMode: boolean;
	session: ComposeSession;
}) {
	const [saveError, setSaveError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const inFlightSaveRef = useRef<Promise<boolean> | null>(null);

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

	const runPersistDraft = useCallback(async (): Promise<boolean> => {
		if (isForwardMode || !session.canAutosave()) {
			return false;
		}

		const current = fieldsRef.current;
		const currentAttachments = attachmentsRef.current;
		const blockedReason = getSaveBlockedReason(
			current,
			currentAttachments,
			Boolean(reply),
		);
		if (blockedReason) {
			setSaveError(blockedReason);
			return false;
		}

		setIsSaving(true);
		setSaveError(null);

		try {
			const result = await persistDraft({
				mailboxId,
				draftId: draftIdRef.current ?? draftId,
				fields: current,
				attachments: currentAttachments,
				attachmentsDirty: attachmentsDirtyRef.current,
				reply,
				createDraft: createMutation.mutateAsync,
				updateDraft: updateMutation.mutateAsync,
				refreshAttachments: refreshStoredAttachments,
			});

			if (!result.ok) {
				setSaveError(result.error);
				return false;
			}

			draftIdRef.current = result.draftId;
			setDraftId(result.draftId);
			attachmentsDirtyRef.current = result.attachmentsDirty;
			return true;
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
		draftIdRef,
		setDraftId,
		session,
	]);

	const runPersist = useCallback(() => {
		const promise = runPersistDraft().finally(() => {
			if (inFlightSaveRef.current === promise) {
				inFlightSaveRef.current = null;
			}
		});
		inFlightSaveRef.current = promise;
		return promise;
	}, [runPersistDraft]);

	const scheduleSave = useCallback(() => {
		if (isForwardMode || !session.canAutosave()) {
			return;
		}

		const current = fieldsRef.current;
		const currentAttachments = attachmentsRef.current;
		if (!canAutosaveCompose(current, currentAttachments, Boolean(reply))) {
			return;
		}

		if (timerRef.current) {
			clearTimeout(timerRef.current);
		}

		timerRef.current = setTimeout(() => {
			timerRef.current = null;
			void runPersist();
		}, AUTOSAVE_MS);
	}, [runPersist, isForwardMode, reply, fieldsRef, attachmentsRef, session]);

	const clearScheduledSave = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	// Cancels any pending autosave and waits for an already-running one to
	// finish, so callers (e.g. send) can operate on a fully-persisted draft
	// without racing a concurrent draft update.
	const flushPendingSave = useCallback(async () => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}

		const inFlight = inFlightSaveRef.current;
		if (inFlight) {
			await inFlight;
		}
	}, []);

	const saveNow = useCallback(async (): Promise<boolean> => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}

		const inFlight = inFlightSaveRef.current;
		if (inFlight) {
			await inFlight;
		}

		return runPersistDraft();
	}, [runPersistDraft]);

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
		flushPendingSave,
		saveNow,
		createMutation,
		updateMutation,
	};
}
