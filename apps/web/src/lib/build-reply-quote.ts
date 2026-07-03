import { getPlainTextSource, parseReplyBody } from "@/lib/parse-reply-body";

export type ReplyQuoteParent = {
	from: string;
	text?: string | null;
	html?: string | null;
	preview?: string | null;
	sentAt?: string | null;
	receivedAt?: string | null;
};

export type ReplyQuoteContent = {
	attribution: string;
	quotedText: string;
};

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

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

export function formatReplyQuotePlainText({
	attribution,
	quotedText,
}: ReplyQuoteContent): string {
	return `${attribution}\n${quoteLines(quotedText)}`;
}

function paragraphHtml(text: string): string {
	const inner = text
		.split("\n")
		.map((line) => escapeHtml(line))
		.join("<br>");
	return `<p>${inner}</p>`;
}

export function buildReplyQuoteHtml({
	attribution,
	quotedText,
}: ReplyQuoteContent): string {
	const paragraphs = [paragraphHtml(attribution)];

	for (const block of quotedText.split(/\n\n+/)) {
		const trimmed = block.trim();
		if (trimmed) {
			paragraphs.push(paragraphHtml(trimmed));
		}
	}

	return `<blockquote type="cite" class="quote">${paragraphs.join("")}</blockquote>`;
}

export function hasReplyQuoteHtml(html: string): boolean {
	return /class=["']quote["']/.test(html) && /type=["']cite["']/.test(html);
}

export function buildReplyQuote(parent: ReplyQuoteParent): ReplyQuoteContent | null {
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

	return { attribution, quotedText: visibleBody };
}

export function buildReplyQuotedText(parent: ReplyQuoteParent): string | null {
	const quote = buildReplyQuote(parent);
	if (!quote) {
		return null;
	}

	return formatReplyQuotePlainText(quote);
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

export function ensureReplyQuoteHtml(
	currentHtml: string,
	quote: ReplyQuoteContent | null,
): string {
	if (!quote) {
		return currentHtml;
	}

	if (hasReplyQuoteHtml(currentHtml)) {
		return currentHtml;
	}

	const quoteHtml = buildReplyQuoteHtml(quote);
	const trimmed = currentHtml.trim();

	if (!trimmed || trimmed === "<p></p>" || trimmed === "<p><br></p>") {
		return `<p></p>${quoteHtml}`;
	}

	return `${currentHtml}${quoteHtml}`;
}

export function parseReplyQuoteBlockquote(element: HTMLElement): ReplyQuoteContent {
	const paragraphs = Array.from(element.querySelectorAll(":scope > p"));
	if (paragraphs.length === 0) {
		return {
			attribution: "",
			quotedText: element.textContent?.trim() ?? "",
		};
	}

	const attribution = paragraphTextContent(paragraphs[0] as HTMLElement);
	const quotedText = paragraphs
		.slice(1)
		.map((paragraph) => paragraphTextContent(paragraph as HTMLElement))
		.join("\n\n");

	return { attribution, quotedText };
}

function paragraphTextContent(paragraph: HTMLElement): string {
	const parts: string[] = [];

	for (const node of paragraph.childNodes) {
		if (node.nodeType === Node.TEXT_NODE) {
			parts.push(node.textContent ?? "");
			continue;
		}

		if (node.nodeName === "BR") {
			parts.push("\n");
			continue;
		}

		parts.push(node.textContent ?? "");
	}

	return parts.join("");
}
