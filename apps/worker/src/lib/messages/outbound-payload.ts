import type { EmailAddressInput } from "../addresses";
import { formatEmailAddressList, firstEmailAddress } from "../addresses";

export type OutboundMessageBody = {
	to: EmailAddressInput[];
	cc?: EmailAddressInput[];
	bcc?: EmailAddressInput[];
	subject: string;
	text?: string;
	html?: string;
};

export type MailboxScopedBody = {
	mailboxId: string;
};

export type CreateDraftBody = OutboundMessageBody &
	MailboxScopedBody & {
		threadId?: string;
		inReplyToMessageId?: string;
	};

export type SendMessageBody = OutboundMessageBody & MailboxScopedBody;

export type ReplyBody = MailboxScopedBody & {
	to?: EmailAddressInput[];
	cc?: EmailAddressInput[];
	bcc?: EmailAddressInput[];
	subject?: string;
	text?: string;
	html?: string;
	replyAll?: boolean;
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

	if (!Array.isArray(value.to) || value.to.length === 0) {
		throw new Error("Field 'to' must be a non-empty array");
	}

	parseTextOrHtml(value);

	return {
		mailboxId,
		to: value.to as EmailAddressInput[],
		cc: value.cc as EmailAddressInput[] | undefined,
		bcc: value.bcc as EmailAddressInput[] | undefined,
		subject: typeof value.subject === "string" ? value.subject.trim() : "",
		text: typeof value.text === "string" ? value.text : undefined,
		html: typeof value.html === "string" ? value.html : undefined,
		threadId: typeof value.threadId === "string" ? value.threadId : undefined,
		inReplyToMessageId:
			typeof value.inReplyToMessageId === "string"
				? value.inReplyToMessageId
				: undefined,
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
		replyAll: value.replyAll === true,
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
