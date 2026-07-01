import { formatEmailAddressList } from "../addresses";
import type { MimeMessageContent } from "./mime-message-content";
import type { OutboundMessageBody } from "./outbound-payload";

export type OutboundThreadingParams = {
	inReplyTo?: string | null;
	references?: string[] | null;
};

export type OutboundSendParams = OutboundThreadingParams & {
	from: string;
	payload: OutboundMessageBody;
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
		content: string;
		disposition: "attachment" | "inline";
		contentId?: string;
	}[];
};

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
		to: formatEmailAddressList(params.payload.to),
		cc: params.payload.cc?.length
			? formatEmailAddressList(params.payload.cc)
			: undefined,
		bcc: params.payload.bcc?.length
			? formatEmailAddressList(params.payload.bcc)
			: undefined,
		subject: params.payload.subject,
		text: params.payload.text,
		html: params.payload.html,
		headers,
	};
}
