import { useEffect, useRef, useState } from "react";

import { assertData } from "@/lib/api/errors";
import {
	createDraft,
	getMessage,
} from "@/lib/api/client";
import {
	buildReplyQuotedText,
	ensureReplyQuoteBody,
} from "@/lib/build-reply-quote";
import { plainTextToHtml } from "@/lib/compose-body";
import { hydrateInlineImagesForEditor } from "@/lib/email-html";
import {
	type ComposeAttachment,
	createStoredAttachment,
} from "@/lib/compose-attachments";
import {
	EMPTY_FIELDS,
	type ComposeForwardContext,
	type ComposeReplyContext,
	type ForwardSource,
	messageToFields,
} from "./types";

export function useComposeInit(
	mailboxId: string,
	options?: {
		reply?: ComposeReplyContext;
		forward?: ComposeForwardContext;
		existingDraftId?: string;
	},
) {
	const reply = options?.reply;
	const forward = options?.forward;
	const existingDraftId = options?.existingDraftId;

	const [draftId, setDraftId] = useState<string | null>(
		existingDraftId ?? null,
	);
	const [fields, setFields] = useState(EMPTY_FIELDS);
	const [attachments, setAttachments] = useState<ComposeAttachment[]>([]);
	const [forwardSource, setForwardSource] = useState<ForwardSource | null>(
		null,
	);
	const [initialized, setInitialized] = useState(
		!reply && !forward && !existingDraftId,
	);
	const replyDraftStartedRef = useRef(false);

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

				const baseFields = messageToFields(draft);
				const bodyHtml = await hydrateInlineImagesForEditor(
					baseFields.bodyHtml,
					draft.attachments ?? [],
				);

				setFields({ ...baseFields, bodyHtml });
				setAttachments(
					(draft.attachments ?? [])
						.map((attachment) => createStoredAttachment(attachment))
						.filter(
							(attachment): attachment is ComposeAttachment =>
								attachment !== null,
						),
				);
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

		// Draft creation is a one-time side effect. Guard with a ref so an
		// unstable `reply` prop identity or StrictMode's double-invoked effects
		// cannot create duplicate (empty) drafts. setState after unmount is a
		// safe no-op in React 19, so no cancellation flag is needed here.
		if (replyDraftStartedRef.current) {
			return;
		}
		replyDraftStartedRef.current = true;

		void (async () => {
			try {
				let parentForQuote = reply.parentMessage;
				if (!parentForQuote) {
					const { data: parentData } = await getMessage({
						throwOnError: true,
						path: { id: reply.inReplyToMessageId },
						query: { mailboxId },
					});
					const parentMessage = assertData(parentData, "getMessage");

					parentForQuote = {
						from: parentMessage.from ?? "",
						text: parentMessage.text,
						html: parentMessage.html,
						preview: parentMessage.preview,
						sentAt: parentMessage.sentAt,
						receivedAt: parentMessage.receivedAt,
					};
				}

				const { data: created } = await createDraft({
					throwOnError: true,
					body: {
						mailboxId,
						inReplyToMessageId: reply.inReplyToMessageId,
						threadId: reply.threadId,
						replyAll: reply.replyAll === true ? true : undefined,
						to: [],
						subject: "",
						text: "",
					},
				});
				const draftRef = assertData(created, "createDraft");
				if (!draftRef.id) {
					return;
				}

				const { data } = await getMessage({
					throwOnError: true,
					path: { id: draftRef.id },
					query: { mailboxId },
				});
				const draft = assertData(data, "getMessage");

				const baseFields = messageToFields(draft);
				const quotedText = buildReplyQuotedText(parentForQuote);
				const body = ensureReplyQuoteBody(baseFields.body, quotedText);

				setFields({
					...baseFields,
					body,
					bodyHtml: plainTextToHtml(body),
				});
				setDraftId(draftRef.id);
				setInitialized(true);
			} catch {
				setInitialized(true);
			}
		})();
	}, [reply, mailboxId, initialized, existingDraftId]);

	useEffect(() => {
		if (!forward || initialized || existingDraftId) {
			return;
		}

		let cancelled = false;

		void (async () => {
			try {
				const { data } = await getMessage({
					throwOnError: true,
					path: { id: forward.messageId },
					query: { mailboxId },
				});
				const parent = assertData(data, "getMessage");
				if (cancelled) {
					return;
				}

				const forwardedAttachments = (parent.attachments ?? [])
					.map((attachment) => createStoredAttachment(attachment))
					.filter(
						(attachment): attachment is ComposeAttachment =>
							attachment !== null,
					);

				setFields(EMPTY_FIELDS);
				setForwardSource({
					messageId: forward.messageId,
					from: parent.from,
					subject: parent.subject,
					preview: parent.preview,
					sentAt: parent.sentAt,
					receivedAt: parent.receivedAt,
					attachments: forwardedAttachments,
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
	}, [forward, mailboxId, initialized, existingDraftId]);

	return {
		draftId,
		setDraftId,
		fields,
		setFields,
		attachments,
		setAttachments,
		forwardSource,
		initialized,
		isForwardMode: Boolean(forward),
	};
}
