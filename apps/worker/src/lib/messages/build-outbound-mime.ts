import { formatEmailAddress, formatEmailAddressList } from "../addresses";
import { attachmentContentToArrayBuffer } from "../attachment-utils";
import type { MimeMessageContent } from "./mime-message-content";
import type { OutboundMessageBody } from "./outbound-payload";
import type { StoredAttachmentInput } from "./stored-attachment-input";

export type OutboundThreadingParams = {
	inReplyTo?: string | null;
	references?: string[] | null;
};

export type OutboundSendParams = OutboundThreadingParams & {
	from: string;
	payload: OutboundMessageBody;
	attachmentInputs?: StoredAttachmentInput[];
};

export type OutboundMimeParams = OutboundSendParams & {
	rfcMessageId: string;
};

export type EmailSendBuilderPayload = {
	from: string;
	to: string | string[];
	cc?: string | string[];
	bcc?: string | string[];
	subject: string;
	text?: string;
	html?: string;
	headers?: Record<string, string>;
	attachments?: {
		filename: string;
		type: string;
		content: string | ArrayBuffer | ArrayBufferView;
		disposition: "attachment" | "inline";
		contentId?: string;
	}[];
};

function storedAttachmentsToEmailAttachments(
	attachmentInputs: StoredAttachmentInput[] | undefined,
): EmailSendBuilderPayload["attachments"] {
	if (!attachmentInputs?.length) {
		return undefined;
	}

	return attachmentInputs.map((attachment, index) => {
		const filename = attachment.filename?.trim() || `attachment-${index + 1}`;
		const base = {
			filename,
			type: attachment.mimeType || "application/octet-stream",
			// The Workers `send_email` binding treats a string as *raw* content
			// (only the REST API base64-decodes it). Binary attachments must be
			// passed as an ArrayBuffer.
			content: attachmentContentToArrayBuffer(attachment.content),
		};

		if (
			attachment.disposition === "inline" &&
			typeof attachment.contentId === "string" &&
			attachment.contentId.trim()
		) {
			return {
				...base,
				disposition: "inline" as const,
				contentId: attachment.contentId.trim(),
			};
		}

		return {
			...base,
			disposition: "attachment" as const,
		};
	});
}

function referencesHeaderValue(
	references: string[] | null | undefined,
): string | undefined {
	if (!references?.length) {
		return undefined;
	}

	return references.join(" ");
}

function buildThreadingHeaders(
	params: OutboundThreadingParams,
): Array<{ key: string; value: string }> {
	const headers: Array<{ key: string; value: string }> = [];

	if (params.inReplyTo) {
		headers.push({ key: "In-Reply-To", value: params.inReplyTo });
	}

	const references = referencesHeaderValue(params.references);
	if (references) {
		headers.push({ key: "References", value: references });
	}

	return headers;
}

export function buildOutboundMimeContent(
	params: OutboundMimeParams,
): MimeMessageContent {
	const headers = [
		{ key: "Message-ID", value: params.rfcMessageId },
		...buildThreadingHeaders(params),
	];

	return {
		from: params.from,
		to: formatEmailAddressList(params.payload.to),
		cc: params.payload.cc?.length
			? formatEmailAddressList(params.payload.cc)
			: null,
		bcc: params.payload.bcc?.length
			? formatEmailAddressList(params.payload.bcc)
			: null,
		subject: params.payload.subject,
		text: params.payload.text ?? null,
		html: params.payload.html ?? null,
		headers,
	};
}

export function buildEmailSendPayload(
	params: OutboundSendParams,
): EmailSendBuilderPayload {
	const headers: Record<string, string> = {};

	for (const header of buildThreadingHeaders(params)) {
		headers[header.key] = header.value;
	}

	return {
		from: params.from,
		to: params.payload.to.map(formatEmailAddress),
		cc: params.payload.cc?.length
			? params.payload.cc.map(formatEmailAddress)
			: undefined,
		bcc: params.payload.bcc?.length
			? params.payload.bcc.map(formatEmailAddress)
			: undefined,
		subject: params.payload.subject,
		text: params.payload.text,
		html: params.payload.html,
		headers,
		attachments: storedAttachmentsToEmailAttachments(params.attachmentInputs),
	};
}
