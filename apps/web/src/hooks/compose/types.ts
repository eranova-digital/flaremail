import type {
	CreateDraftRequest,
	OutboundMessageBody,
} from "@/lib/api/client";
import type { ComposeAttachment } from "@/lib/compose-attachments";

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
};

export function parseRecipients(value: string): CreateDraftRequest["to"] {
	return value
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
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

	if (attachments) {
		body.attachments = attachments;
	}

	return body;
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
			fields.body.trim() ||
			attachments.length > 0,
	);
}

export function messageToFields(message: {
	to?: string | null;
	cc?: string | null;
	bcc?: string | null;
	subject?: string | null;
	text?: string | null;
	preview?: string | null;
}): ComposeFields {
	return {
		to: message.to ?? "",
		cc: message.cc ?? "",
		bcc: message.bcc ?? "",
		subject: message.subject ?? "",
		body: message.text ?? message.preview ?? "",
	};
}
