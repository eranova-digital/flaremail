import { getPlainTextSource, parseReplyBody } from "@/lib/parse-reply-body";

export type ReplyQuoteParent = {
	from: string;
	text?: string | null;
	html?: string | null;
	preview?: string | null;
	sentAt?: string | null;
	receivedAt?: string | null;
};

function quoteLines(text: string): string {
	return text
		.split("\n")
		.map((line) => (line.length > 0 ? `> ${line}` : ">"))
		.join("\n");
}

function formatReplyAttribution(from: string, when: Date): string {
	const day = when.toLocaleDateString("en-GB", { weekday: "short" });
	const date = when.toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
	const time = when.toLocaleTimeString("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	const fromPart = from.includes("<") ? from : `<${from}>`;

	return `On ${day}, ${date} at ${time}, ${fromPart} wrote:`;
}

export function buildReplyQuotedText(parent: ReplyQuoteParent): string | null {
	const plainSource = getPlainTextSource(
		parent.text,
		parent.html,
		parent.preview,
	);
	if (!plainSource) {
		return null;
	}

	const visibleBody = parseReplyBody(plainSource).visibleText.trim();
	if (!visibleBody) {
		return null;
	}

	const when = new Date(parent.sentAt ?? parent.receivedAt ?? Date.now());
	const attribution = formatReplyAttribution(parent.from, when);

	return `${attribution}\n${quoteLines(visibleBody)}`;
}

export function ensureReplyQuoteBody(
	currentBody: string,
	quotedText: string | null,
): string {
	if (!quotedText) {
		return currentBody;
	}

	if (currentBody.includes(" wrote:")) {
		return currentBody;
	}

	const trimmed = currentBody.trim();
	if (!trimmed) {
		return `\n\n${quotedText}`;
	}

	return `${currentBody}\n\n${quotedText}`;
}
