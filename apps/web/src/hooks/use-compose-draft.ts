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
import {
	type ComposeAttachment,
	composeAttachmentsToOutbound,
	createStoredAttachment,
} from "@/lib/compose-attachments";

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
	attachments?: OutboundMessageBody["attachments"],
): CreateDraftRequest {
	const base: CreateDraftRequest = {
		mailboxId,
		to: parseRecipients(fields.to),
		cc: parseRecipients(fields.cc),
		bcc: parseRecipients(fields.bcc),
		subject: fields.subject,
		text: fields.body,
	};

	if (attachments) {
		base.attachments = attachments;
	}

	if (reply) {
		return {
			...base,
			inReplyToMessageId: reply.inReplyToMessageId,
			threadId: reply.threadId,
		};
	}

	return base;
}

function outboundFromFields(
	fields: ComposeFields,
	attachments?: OutboundMessageBody["attachments"],
): OutboundMessageBody {
	const body: OutboundMessageBody = {
		to: parseRecipients(fields.to),
		cc: parseRecipients(fields.cc),
		bcc: parseRecipients(fields.bcc),
		subject: fields.subject,
		text: fields.body,
	};

	if (attachments) {
		body.attachments = attachments;
	}

	return body;
}

function hasComposeContent(
	fields: ComposeFields,
	attachments: ComposeAttachment[],
): boolean {
	return Boolean(
		fields.to.trim() ||
			fields.cc.trim() ||
			fields.bcc.trim() ||
			fields.subject.trim() ||
			fields.body.trim() ||
			attachments.length > 0,
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
	const [attachments, setAttachments] = useState<ComposeAttachment[]>([]);
	const [initialized, setInitialized] = useState(
		!reply && !existingDraftId,
	);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const fieldsRef = useRef(fields);
	const attachmentsRef = useRef(attachments);
	const attachmentsDirtyRef = useRef(false);
	fieldsRef.current = fields;
	attachmentsRef.current = attachments;

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
				setAttachments(
					(draft.attachments ?? [])
						.map((attachment) => createStoredAttachment(attachment))
						.filter(
							(attachment): attachment is ComposeAttachment =>
								attachment !== null,
						),
				);
				attachmentsDirtyRef.current = false;
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
		[mailboxId],
	);

	const persistDraft = useCallback(async () => {
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
	}, [createMutation, updateMutation, draftId, mailboxId, reply, refreshStoredAttachments]);

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

	const updateAttachments = useCallback(
		(next: ComposeAttachment[]) => {
			attachmentsRef.current = next;
			attachmentsDirtyRef.current = true;
			setAttachments(next);
			scheduleSave();
		},
		[scheduleSave],
	);

	const send = useCallback(async () => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
		}

		const current = fieldsRef.current;
		const currentAttachments = attachmentsRef.current;
		const outboundAttachments = await composeAttachmentsToOutbound(
			currentAttachments,
		);

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
		attachments,
		updateFields,
		updateAttachments,
		send,
		isSaving,
		saveError,
		isSending: sendMutation.isPending,
		sendError: sendMutation.error,
		initialized,
		draftId,
	};
}
