import type {
	CreateDraftRequest,
	OutboundMessageBody,
} from "@/lib/api/client";
import type { ComposeAttachment } from "@/lib/compose-attachments";
import type { ReplyQuoteParent } from "@/lib/build-reply-quote";
import {
	composeBodyFromMessage,
	composeBodyHasContent,
	isEmptyEditorHtml,
} from "@/lib/compose-body";
import i18n from "@/lib/i18n";

export type { ReplyQuoteParent };

export type ComposeFields = {
	to: string;
	cc: string;
	bcc: string;
	subject: string;
	body: string;
	bodyHtml: string;
	identityId: string | null;
};

export type ComposeReplyContext = {
	inReplyToMessageId: string;
	threadId?: string;
	parentMessage?: ReplyQuoteParent;
	replyAll?: boolean;
};

export type ComposeForwardContext = {
	messageId: string;
};

export type ForwardSource = {
	messageId: string;
	from?: string | null;
	subject?: string | null;
	preview?: string | null;
	sentAt?: string | null;
	receivedAt?: string | null;
	attachments: ComposeAttachment[];
};

export const AUTOSAVE_MS = 1500;

export const EMPTY_FIELDS: ComposeFields = {
	to: "",
	cc: "",
	bcc: "",
	subject: "",
	body: "",
	bodyHtml: "<p></p>",
	identityId: null,
};

export function parseRecipients(value: string): CreateDraftRequest["to"] {
	return value
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
}

export function formatRecipients(recipients: string[]): string {
	return recipients.join(", ");
}

export function fieldsToPayload(
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

	if (!isEmptyEditorHtml(fields.bodyHtml)) {
		base.html = fields.bodyHtml;
	}

	if (attachments) {
		base.attachments = attachments;
	}

	if (reply) {
		return {
			...base,
			inReplyToMessageId: reply.inReplyToMessageId,
			threadId: reply.threadId,
			replyAll: reply.replyAll === true ? true : undefined,
			...(fields.identityId ? { identityId: fields.identityId } : {}),
		};
	}

	return {
		...base,
		...(fields.identityId ? { identityId: fields.identityId } : {}),
	};
}

export function outboundFromFields(
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

	if (!isEmptyEditorHtml(fields.bodyHtml)) {
		body.html = fields.bodyHtml;
	}

	if (attachments) {
		body.attachments = attachments;
	}

	if (fields.identityId) {
		body.identityId = fields.identityId;
	}

	return body;
}

export function hasComposeSubject(fields: ComposeFields): boolean {
	return Boolean(fields.subject.trim());
}

export function hasComposeRecipient(fields: ComposeFields): boolean {
	return Boolean(fields.to.trim());
}

export function hasComposeContent(
	fields: ComposeFields,
	attachments: ComposeAttachment[],
): boolean {
	return Boolean(
		fields.to.trim() ||
			fields.cc.trim() ||
			fields.bcc.trim() ||
			fields.subject.trim() ||
			composeBodyHasContent(fields.body, fields.bodyHtml) ||
			attachments.length > 0,
	);
}

export function canAutosaveCompose(
	fields: ComposeFields,
	attachments: ComposeAttachment[],
	isReply: boolean,
): boolean {
	if (!hasComposeSubject(fields)) {
		return false;
	}

	// Replies resolve their recipients server-side, so the composer's "to" field
	// isn't required. New messages must have a recipient (the backend rejects an
	// empty "to"), so don't attempt to save until one is entered.
	if (!isReply && !hasComposeRecipient(fields)) {
		return false;
	}

	return hasComposeContent(fields, attachments);
}

export function getSaveBlockedReason(
	fields: ComposeFields,
	attachments: ComposeAttachment[],
	isReply: boolean,
): string | null {
	if (!hasComposeSubject(fields)) {
		return i18n.t("validation.subjectRequired", { ns: "compose" });
	}

	if (!isReply && !hasComposeRecipient(fields)) {
		return i18n.t("validation.recipientRequired", { ns: "compose" });
	}

	if (!hasComposeContent(fields, attachments)) {
		return i18n.t("validation.messageRequired", { ns: "compose" });
	}

	return null;
}

export function messageToFields(message: {
	to?: string | null;
	cc?: string | null;
	bcc?: string | null;
	subject?: string | null;
	text?: string | null;
	html?: string | null;
	preview?: string | null;
}): ComposeFields {
	const { body, bodyHtml } = composeBodyFromMessage(message);

	return {
		to: message.to ?? "",
		cc: message.cc ?? "",
		bcc: message.bcc ?? "",
		subject: message.subject ?? "",
		body,
		bodyHtml,
		identityId: null,
	};
}
