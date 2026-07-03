import type { EmailAddressInput } from "../addresses";
import { formatEmailAddressList, firstEmailAddress } from "../addresses";
import type { OutboundAttachmentInput } from "./outbound-attachments";

export type { OutboundAttachmentInput } from "./outbound-attachments";

export type OutboundMessageBody = {
	to: EmailAddressInput[];
	cc?: EmailAddressInput[];
	bcc?: EmailAddressInput[];
	subject: string;
	text?: string;
	html?: string;
	attachments?: OutboundAttachmentInput[];
};

export type MailboxScopedBody = {
	mailboxId: string;
};

export type CreateDraftBody = OutboundMessageBody &
	MailboxScopedBody & {
		threadId?: string;
		inReplyToMessageId?: string;
		replyAll?: boolean;
	};

export type SendMessageBody = OutboundMessageBody & MailboxScopedBody;

export type ReplyBody = MailboxScopedBody & {
	to?: EmailAddressInput[];
	cc?: EmailAddressInput[];
	bcc?: EmailAddressInput[];
	subject?: string;
	text?: string;
	html?: string;
	attachments?: OutboundAttachmentInput[];
	replyAll?: boolean;
};

export type ForwardBody = MailboxScopedBody & {
	to: EmailAddressInput[];
	cc?: EmailAddressInput[];
	bcc?: EmailAddressInput[];
	subject?: string;
	text?: string;
	html?: string;
	attachments?: OutboundAttachmentInput[];
	includeAttachments?: boolean;
	includeQuotedBody?: boolean;
};

function requireMailboxId(value: Record<string, unknown>): string {
	if (typeof value.mailboxId !== "string" || !value.mailboxId.trim()) {
		throw new Error("Field 'mailboxId' is required");
	}

	return value.mailboxId.trim();
}

function parseTextOrHtml(value: Record<string, unknown>): void {
	if (value.text === undefined && value.html === undefined) {
		throw new Error("At least one of 'text' or 'html' is required");
	}
}

function parseOutboundAttachments(
	value: unknown,
): OutboundAttachmentInput[] | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (!Array.isArray(value)) {
		throw new Error("Field 'attachments' must be an array");
	}

	return value.map((item, index) => {
		if (!item || typeof item !== "object") {
			throw new Error(`attachments[${index}] must be an object`);
		}

		const attachment = item as Record<string, unknown>;

		if (
			typeof attachment.filename !== "string" ||
			!attachment.filename.trim()
		) {
			throw new Error(`attachments[${index}].filename is required`);
		}

		if (
			typeof attachment.mimeType !== "string" ||
			!attachment.mimeType.trim()
		) {
			throw new Error(`attachments[${index}].mimeType is required`);
		}

		if (typeof attachment.content !== "string" || !attachment.content.trim()) {
			throw new Error(`attachments[${index}].content is required`);
		}

		const disposition = attachment.disposition;
		if (
			disposition !== undefined &&
			disposition !== "attachment" &&
			disposition !== "inline"
		) {
			throw new Error(
				`attachments[${index}].disposition must be 'attachment' or 'inline'`,
			);
		}

		return {
			filename: attachment.filename.trim(),
			mimeType: attachment.mimeType.trim(),
			content: attachment.content.replace(/\s+/g, ""),
			disposition:
				disposition === "inline" || disposition === "attachment"
					? disposition
					: undefined,
			contentId:
				typeof attachment.contentId === "string"
					? attachment.contentId
					: undefined,
		};
	});
}

export function parseOutboundMessageBody(body: unknown): OutboundMessageBody {
	if (!body || typeof body !== "object") {
		throw new Error("Request body must be an object");
	}

	const value = body as Record<string, unknown>;

	if (!Array.isArray(value.to) || value.to.length === 0) {
		throw new Error("Field 'to' must be a non-empty array");
	}

	if (typeof value.subject !== "string" || !value.subject.trim()) {
		throw new Error("Field 'subject' is required");
	}

	parseTextOrHtml(value);

	return {
		to: value.to as EmailAddressInput[],
		cc: value.cc as EmailAddressInput[] | undefined,
		bcc: value.bcc as EmailAddressInput[] | undefined,
		subject: value.subject.trim(),
		text: typeof value.text === "string" ? value.text : undefined,
		html: typeof value.html === "string" ? value.html : undefined,
		attachments: parseOutboundAttachments(value.attachments),
	};
}

export function parseSendMessageBody(body: unknown): SendMessageBody {
	if (!body || typeof body !== "object") {
		throw new Error("Request body must be an object");
	}

	const value = body as Record<string, unknown>;
	const mailboxId = requireMailboxId(value);

	return {
		mailboxId,
		...parseOutboundMessageBody(body),
	};
}

export function parseCreateDraftBody(body: unknown): CreateDraftBody {
	if (!body || typeof body !== "object") {
		throw new Error("Request body must be an object");
	}

	const value = body as Record<string, unknown>;
	const mailboxId = requireMailboxId(value);
	const isReplyDraft =
		typeof value.threadId === "string" ||
		typeof value.inReplyToMessageId === "string";

	if (!isReplyDraft) {
		return {
			mailboxId,
			...parseOutboundMessageBody(body),
			threadId: undefined,
			inReplyToMessageId: undefined,
		};
	}

	const to = Array.isArray(value.to) ? (value.to as EmailAddressInput[]) : [];
	const hasExplicitRecipients = to.length > 0;

	if (!hasExplicitRecipients && typeof value.inReplyToMessageId !== "string") {
		throw new Error("Field 'to' must be a non-empty array");
	}

	parseTextOrHtml(value);

	return {
		mailboxId,
		to,
		cc: value.cc as EmailAddressInput[] | undefined,
		bcc: value.bcc as EmailAddressInput[] | undefined,
		subject: typeof value.subject === "string" ? value.subject.trim() : "",
		text: typeof value.text === "string" ? value.text : undefined,
		html: typeof value.html === "string" ? value.html : undefined,
		attachments: parseOutboundAttachments(value.attachments),
		threadId: typeof value.threadId === "string" ? value.threadId : undefined,
		inReplyToMessageId:
			typeof value.inReplyToMessageId === "string"
				? value.inReplyToMessageId
				: undefined,
		replyAll: value.replyAll === true,
	};
}

export function parseReplyBody(body: unknown): ReplyBody {
	if (!body || typeof body !== "object") {
		throw new Error("Request body must be an object");
	}

	const value = body as Record<string, unknown>;
	const mailboxId = requireMailboxId(value);
	parseTextOrHtml(value);

	return {
		mailboxId,
		to: value.to as EmailAddressInput[] | undefined,
		cc: value.cc as EmailAddressInput[] | undefined,
		bcc: value.bcc as EmailAddressInput[] | undefined,
		subject:
			typeof value.subject === "string" && value.subject.trim()
				? value.subject.trim()
				: undefined,
		text: typeof value.text === "string" ? value.text : undefined,
		html: typeof value.html === "string" ? value.html : undefined,
		attachments: parseOutboundAttachments(value.attachments),
		replyAll: value.replyAll === true,
	};
}

export function parseForwardBody(body: unknown): ForwardBody {
	if (!body || typeof body !== "object") {
		throw new Error("Request body must be an object");
	}

	const value = body as Record<string, unknown>;
	const mailboxId = requireMailboxId(value);

	if (!Array.isArray(value.to) || value.to.length === 0) {
		throw new Error("Field 'to' must be a non-empty array");
	}

	return {
		mailboxId,
		to: value.to as EmailAddressInput[],
		cc: value.cc as EmailAddressInput[] | undefined,
		bcc: value.bcc as EmailAddressInput[] | undefined,
		subject:
			typeof value.subject === "string" && value.subject.trim()
				? value.subject.trim()
				: undefined,
		text: typeof value.text === "string" ? value.text : undefined,
		html: typeof value.html === "string" ? value.html : undefined,
		attachments: parseOutboundAttachments(value.attachments),
		includeAttachments: value.includeAttachments !== false,
		includeQuotedBody: value.includeQuotedBody !== false,
	};
}

export function formatRecipients(payload: OutboundMessageBody): {
	to: string;
	cc: string | null;
	bcc: string | null;
	envelopeTo: string;
} {
	const to = formatEmailAddressList(payload.to);
	const cc = payload.cc?.length ? formatEmailAddressList(payload.cc) : null;
	const bcc = payload.bcc?.length ? formatEmailAddressList(payload.bcc) : null;

	return {
		to,
		cc,
		bcc,
		envelopeTo: firstEmailAddress(payload.to),
	};
}

export function replySubject(parentSubject: string | null): string {
	const subject = parentSubject?.trim() ?? "";
	if (!subject) {
		return "Re:";
	}

	if (/^re:/i.test(subject)) {
		return subject;
	}

	return `Re: ${subject}`;
}
