import EmailReplyParser from "email-reply-parser";

export type ParsedReplyBody = {
	visibleText: string;
	quotedText: string;
	hasQuotedReply: boolean;
};

const parser = new EmailReplyParser();

export function htmlToPlainText(html: string): string {
	const doc = new DOMParser().parseFromString(html, "text/html");
	return doc.body.textContent?.replace(/\u00a0/g, " ") ?? "";
}

export function getPlainTextSource(
	text?: string | null,
	html?: string | null,
	preview?: string | null,
): string | null {
	const trimmedText = text?.trim();
	if (trimmedText) {
		return trimmedText;
	}

	const trimmedHtml = html?.trim();
	if (trimmedHtml) {
		const fromHtml = htmlToPlainText(trimmedHtml).trim();
		if (fromHtml) {
			return fromHtml;
		}
	}

	const trimmedPreview = preview?.trim();
	return trimmedPreview || null;
}

export function parseReplyBody(rawText: string): ParsedReplyBody {
	const email = parser.read(rawText);
	const hasQuotedReply = email
		.getFragments()
		.some((fragment) => fragment.isQuoted());

	return {
		visibleText: email.getVisibleText(),
		quotedText: email.getQuotedText(),
		hasQuotedReply,
	};
}
