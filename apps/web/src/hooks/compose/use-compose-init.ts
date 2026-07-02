import { useEffect, useState } from "react";

import { assertData } from "@/lib/api/errors";
import {
	createDraft,
	getMessage,
} from "@/lib/api/client";
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

				setFields(messageToFields(draft));
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

		let cancelled = false;

		void (async () => {
			try {
				const { data: created } = await createDraft({
					throwOnError: true,
					body: {
						mailboxId,
						inReplyToMessageId: reply.inReplyToMessageId,
						threadId: reply.threadId,
						to: [],
						subject: "",
						text: "",
					},
				});
				const draftRef = assertData(created, "createDraft");
				if (!draftRef.id || cancelled) {
					return;
				}

				const { data } = await getMessage({
					throwOnError: true,
					path: { id: draftRef.id },
					query: { mailboxId },
				});
				const draft = assertData(data, "getMessage");
				if (cancelled) {
					return;
				}

				setFields(messageToFields(draft));
				setDraftId(draftRef.id);
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
