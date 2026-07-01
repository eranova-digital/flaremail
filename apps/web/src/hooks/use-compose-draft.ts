import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { assertData } from "@/lib/api/errors";
import {
	createDraft,
	getMessage,
	sendDraft,
	updateDraft,
	type CreateDraftRequest,
	type OutboundMessageBody,
} from "@/lib/api/client";

export type ComposeFields = {
	to: string;
	cc: string;
	bcc: string;
	subject: string;
	body: string;
};

export type ComposeReplyContext = {
	inReplyToMessageId: string;
	threadId?: string;
};

const AUTOSAVE_MS = 1500;

function parseRecipients(value: string): CreateDraftRequest["to"] {
	return value
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
}

function fieldsToPayload(
	fields: ComposeFields,
	mailboxId: string,
	reply?: ComposeReplyContext,
): CreateDraftRequest {
	const base: CreateDraftRequest = {
		mailboxId,
		to: parseRecipients(fields.to),
		cc: parseRecipients(fields.cc),
		bcc: parseRecipients(fields.bcc),
		subject: fields.subject,
		text: fields.body,
	};

	if (reply) {
		return {
			...base,
			inReplyToMessageId: reply.inReplyToMessageId,
			threadId: reply.threadId,
		};
	}

	return base;
}

function outboundFromFields(fields: ComposeFields): OutboundMessageBody {
	return {
		to: parseRecipients(fields.to),
		cc: parseRecipients(fields.cc),
		bcc: parseRecipients(fields.bcc),
		subject: fields.subject,
		text: fields.body,
	};
}

function hasComposeContent(fields: ComposeFields): boolean {
	return Boolean(
		fields.to.trim() ||
			fields.cc.trim() ||
			fields.bcc.trim() ||
			fields.subject.trim() ||
			fields.body.trim(),
	);
}

export function useComposeDraft(
	mailboxId: string,
	options?: {
		reply?: ComposeReplyContext;
		existingDraftId?: string;
	},
) {
	const reply = options?.reply;
	const existingDraftId = options?.existingDraftId;
	const queryClient = useQueryClient();
	const [draftId, setDraftId] = useState<string | null>(
		existingDraftId ?? null,
	);
	const [fields, setFields] = useState<ComposeFields>({
		to: "",
		cc: "",
		bcc: "",
		subject: "",
		body: "",
	});
	const [initialized, setInitialized] = useState(
		!reply && !existingDraftId,
	);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const fieldsRef = useRef(fields);
	fieldsRef.current = fields;

	const createMutation = useMutation({
		mutationFn: async (payload: CreateDraftRequest) => {
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

	const sendMutation = useMutation({
		mutationFn: async (id: string) => {
			const { data } = await sendDraft({
				throwOnError: true,
				path: { id },
			});
			return assertData(data, "sendDraft");
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["threads", mailboxId] });
			if (draftId) {
				queryClient.invalidateQueries({
					queryKey: ["thread-messages", mailboxId],
				});
			}
		},
	});

	useEffect(() => {
		if (!existingDraftId || initialized) {
			return;
		}

		let cancelled = false;

		void (async () => {
			try {
				const { data } = await getMessage({
					throwOnError: true,
					path: { id: existingDraftId },
					query: { mailboxId },
				});
				const draft = assertData(data, "getMessage");
				if (cancelled) {
					return;
				}

				setFields({
					to: draft.to ?? "",
					cc: draft.cc ?? "",
					bcc: draft.bcc ?? "",
					subject: draft.subject ?? "",
					body: draft.text ?? draft.preview ?? "",
				});
				setDraftId(existingDraftId);
				setInitialized(true);
			} catch {
				if (!cancelled) {
					setInitialized(true);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [existingDraftId, mailboxId, initialized]);

	useEffect(() => {
		if (!reply || initialized || existingDraftId) {
			return;
		}

		let cancelled = false;

		void (async () => {
			try {
				const { data } = await getMessage({
					throwOnError: true,
					path: { id: reply.inReplyToMessageId },
					query: { mailboxId },
				});
				const parent = assertData(data, "getMessage");
				if (cancelled) {
					return;
				}

				const subject = parent.subject?.match(/^re:/i)
					? (parent.subject ?? "")
					: `Re: ${parent.subject ?? ""}`;

				setFields({
					to: parent.from ?? "",
					cc: "",
					bcc: "",
					subject,
					body: "",
				});
				setInitialized(true);
			} catch {
				if (!cancelled) {
					setInitialized(true);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [reply, mailboxId, initialized, existingDraftId]);

	const persistDraft = useCallback(async () => {
		const current = fieldsRef.current;
		if (!hasComposeContent(current)) {
			return;
		}

		setIsSaving(true);
		setSaveError(null);

		try {
			if (!draftId) {
				const created = await createMutation.mutateAsync(
					fieldsToPayload(current, mailboxId, reply),
				);
				if (created.id) {
					setDraftId(created.id);
				}
			} else {
				await updateMutation.mutateAsync({
					id: draftId,
					body: outboundFromFields(current),
				});
			}
		} catch (error) {
			setSaveError(
				error instanceof Error ? error.message : "Failed to save draft",
			);
		} finally {
			setIsSaving(false);
		}
	}, [createMutation, updateMutation, draftId, mailboxId, reply]);

	const scheduleSave = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
		}

		timerRef.current = setTimeout(() => {
			void persistDraft();
		}, AUTOSAVE_MS);
	}, [persistDraft]);

	const updateFields = useCallback(
		(patch: Partial<ComposeFields>) => {
			setFields((prev) => {
				const next = { ...prev, ...patch };
				fieldsRef.current = next;
				return next;
			});
			scheduleSave();
		},
		[scheduleSave],
	);

	const send = useCallback(async () => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
		}

		let id = draftId;
		if (!id) {
			const created = await createMutation.mutateAsync(
				fieldsToPayload(fieldsRef.current, mailboxId, reply),
			);
			id = created.id ?? null;
			if (id) {
				setDraftId(id);
			}
		} else {
			await updateMutation.mutateAsync({
				id,
				body: outboundFromFields(fieldsRef.current),
			});
		}

		if (!id) {
			throw new Error("Draft was not created");
		}

		return sendMutation.mutateAsync(id);
	}, [createMutation, updateMutation, sendMutation, draftId, mailboxId, reply]);

	useEffect(() => {
		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
		};
	}, []);

	return {
		fields,
		updateFields,
		send,
		isSaving,
		saveError,
		isSending: sendMutation.isPending,
		sendError: sendMutation.error,
		initialized,
		draftId,
	};
}
