import type { OutboundMessageBody, CreateDraftRequest } from "@/lib/api/generated/types.gen";
import type { ComposeAttachment } from "@/lib/compose-attachments";
import { composeAttachmentsToOutbound } from "@/lib/compose-attachments";
import { isEmptyEditorHtml } from "@/lib/compose-body";
import type { PersistDraftArgs, PersistDraftResult } from "@/lib/compose/persist-draft";
import type { SendResult } from "@/lib/thread-messages-cache";
import {
	hasComposeRecipient,
	hasComposeSubject,
	parseRecipients,
	type ComposeFields,
	type ComposeForwardContext,
	type ComposeReplyContext,
} from "@/hooks/compose/types";

export type ComposeSendPhase = "idle" | "saving" | "sending";

export type ComposeSendControllerDeps = {
	mailboxId: string;
	draftId: string | null;
	reply?: ComposeReplyContext;
	forward?: ComposeForwardContext;
	knownThreadId?: string;
	selfAddress?: string | null;
	flushPendingSave: () => Promise<void>;
	getFields: () => ComposeFields;
	getAttachments: () => ComposeAttachment[];
	getAttachmentsDirty: () => boolean;
	setDraftId: (id: string) => void;
	setAttachmentsDirty: (dirty: boolean) => void;
	createDraft: (payload: CreateDraftRequest) => Promise<{ id?: string }>;
	updateDraft: (args: {
		id: string;
		body: OutboundMessageBody;
	}) => Promise<unknown>;
	sendDraft: (id: string) => Promise<SendResult>;
	forwardToMessage: (args: {
		messageId: string;
		payload: OutboundMessageBody & {
			mailboxId: string;
			includeAttachments?: boolean;
			includeQuotedBody?: boolean;
		};
	}) => Promise<SendResult>;
	persistDraft: (args: PersistDraftArgs) => Promise<PersistDraftResult>;
	withPendingSend: <T>(
		threadId: string | undefined,
		draftId: string,
		preview: {
			selfAddress: string | null;
			to: string;
			inReplyToMessageId?: string;
			hasAttachments: boolean;
		},
		sendFn: () => Promise<T>,
	) => Promise<T>;
};

export class ComposeSendController {
	private phase: ComposeSendPhase = "idle";

	constructor(private readonly deps: ComposeSendControllerDeps) {}

	get currentPhase(): ComposeSendPhase {
		return this.phase;
	}

	get isBusy(): boolean {
		return this.phase !== "idle";
	}

	private setPhase(phase: ComposeSendPhase) {
		this.phase = phase;
	}

	async send(): Promise<SendResult> {
		if (this.isBusy) {
			throw new Error("Send already in progress");
		}

		this.setPhase("saving");

		try {
			if (this.deps.forward) {
				this.setPhase("sending");
				return await this.sendForward();
			}

			await this.deps.flushPendingSave();
			this.setPhase("sending");
			return await this.sendDraftPath();
		} finally {
			this.setPhase("idle");
		}
	}

	private async sendForward(): Promise<SendResult> {
		const forward = this.deps.forward;
		if (!forward) {
			throw new Error("Forward context is required");
		}

		const current = this.deps.getFields();
		if (!hasComposeSubject(current)) {
			throw new Error("Subject is required");
		}

		const recipients = parseRecipients(current.to);
		if (recipients.length === 0) {
			throw new Error("Recipient is required");
		}

		const outboundAttachments = await composeAttachmentsToOutbound(
			this.deps.getAttachments(),
		);

		return this.deps.forwardToMessage({
			messageId: forward.messageId,
			payload: {
				mailboxId: this.deps.mailboxId,
				to: recipients,
				cc: parseRecipients(current.cc),
				bcc: parseRecipients(current.bcc),
				subject: current.subject ?? "",
				text: current.body,
				html: isEmptyEditorHtml(current.bodyHtml)
					? undefined
					: current.bodyHtml,
				attachments: outboundAttachments,
				includeAttachments: true,
				includeQuotedBody: true,
			},
		});
	}

	private async sendDraftPath(): Promise<SendResult> {
		const current = this.deps.getFields();
		if (!hasComposeSubject(current)) {
			throw new Error("Subject is required");
		}
		if (!this.deps.reply && !hasComposeRecipient(current)) {
			throw new Error("Recipient is required");
		}

		const currentAttachments = this.deps.getAttachments();
		const persistResult = await this.deps.persistDraft({
			mailboxId: this.deps.mailboxId,
			draftId: this.deps.draftId,
			fields: current,
			attachments: currentAttachments,
			attachmentsDirty: this.deps.getAttachmentsDirty(),
			reply: this.deps.reply,
			createDraft: this.deps.createDraft,
			updateDraft: this.deps.updateDraft,
		});

		if (!persistResult.ok) {
			throw new Error(persistResult.error);
		}

		this.deps.setDraftId(persistResult.draftId);
		this.deps.setAttachmentsDirty(persistResult.attachmentsDirty);

		return this.deps.withPendingSend(
			this.deps.knownThreadId,
			persistResult.draftId,
			{
				selfAddress: this.deps.selfAddress ?? null,
				to: current.to,
				inReplyToMessageId: this.deps.reply?.inReplyToMessageId,
				hasAttachments: currentAttachments.length > 0,
			},
			() => this.deps.sendDraft(persistResult.draftId),
		);
	}
}
