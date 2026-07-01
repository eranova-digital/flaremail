import type { Email as ParsedEmail } from "postal-mime";

export type ThreadingHeaders = {
	inReplyTo: string | null;
	references: string[] | null;
	messageId: string | null;
};

export function normalizeMessageId(value: string | null | undefined): string | null {
	if (!value) {
		return null;
	}

	const normalized = value.replace(/\s+/g, " ").trim();
	return normalized || null;
}

function getWorkerHeaderValues(headers: Headers, name: string): string[] {
	const values: string[] = [];

	for (const [key, value] of headers.entries()) {
		if (key.toLowerCase() === name.toLowerCase() && value.trim()) {
			values.push(value);
		}
	}

	return values;
}

function getParsedHeaderValues(parsed: ParsedEmail, name: string): string[] {
	return parsed.headers
		.filter((entry) => entry.key === name && entry.value.trim())
		.map((entry) => entry.value);
}

function joinHeaderValues(values: string[]): string | null {
	if (!values.length) {
		return null;
	}

	return values.join(" ");
}

function parseReferencesList(value: string | null | undefined): string[] | null {
	if (!value) {
		return null;
	}

	const ids = value
		.split(/,\s*/)
		.flatMap((part) => part.trim().split(/\s+/))
		.map((part) => normalizeMessageId(part))
		.filter((id): id is string => Boolean(id));

	return ids.length ? ids : null;
}

export function extractThreadingHeaders(
	headers: Headers,
	parsed: ParsedEmail,
): ThreadingHeaders {
	const inReplyTo =
		normalizeMessageId(
			joinHeaderValues(getWorkerHeaderValues(headers, "In-Reply-To")),
		) ??
		normalizeMessageId(parsed.inReplyTo) ??
		normalizeMessageId(
			joinHeaderValues(getParsedHeaderValues(parsed, "in-reply-to")),
		);

	const referencesRaw =
		joinHeaderValues(getWorkerHeaderValues(headers, "References")) ??
		joinHeaderValues(getParsedHeaderValues(parsed, "references")) ??
		parsed.references ??
		null;

	const references = parseReferencesList(referencesRaw);

	const messageId =
		normalizeMessageId(
			joinHeaderValues(getWorkerHeaderValues(headers, "Message-ID")),
		) ??
		normalizeMessageId(parsed.messageId) ??
		normalizeMessageId(
			joinHeaderValues(getParsedHeaderValues(parsed, "message-id")),
		);

	return { inReplyTo, references, messageId };
}
