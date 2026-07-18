import EmailReplyParser from "email-reply-parser";

export type ParsedReplyBody = {
	visibleText: string;
	quotedText: string;
	hasQuotedReply: boolean;
};

export type SplitQuotedHtml = {
	visibleHtml: string;
	quotedHtml: string | null;
};

const parser = new EmailReplyParser();

const HTML_QUOTE_SELECTOR = [
	"div.gmail_quote",
	"blockquote.gmail_quote",
	'blockquote[type="cite"]',
	"blockquote.quote",
].join(", ");

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

function trimTrailingEmptyNodes(root: HTMLElement): void {
	let child = root.lastChild;
	while (child) {
		const previous = child.previousSibling;
		if (child.nodeType === Node.TEXT_NODE) {
			if (!(child.textContent ?? "").trim()) {
				root.removeChild(child);
				child = previous;
				continue;
			}
			break;
		}
		if (child instanceof HTMLElement) {
			const tag = child.tagName;
			if (
				tag === "BR" ||
				((tag === "DIV" || tag === "P") &&
					!(child.textContent ?? "").trim() &&
					child.children.length === 0)
			) {
				root.removeChild(child);
				child = previous;
				continue;
			}
		}
		break;
	}
}

/**
 * Split an HTML message into the visible reply and collapsed quoted history.
 * Prefers Gmail / cite blockquote markers used by Flaremail and common clients.
 */
export function splitQuotedHtml(html: string): SplitQuotedHtml {
	const trimmed = html.trim();
	if (!trimmed) {
		return { visibleHtml: html, quotedHtml: null };
	}

	const doc = new DOMParser().parseFromString(trimmed, "text/html");
	const root = doc.body;
	const quoteRoot = root.querySelector(HTML_QUOTE_SELECTOR);
	if (!quoteRoot) {
		return { visibleHtml: html, quotedHtml: null };
	}

	const quotedParts: string[] = [];
	let node: ChildNode | null = quoteRoot;
	while (node) {
		const next: ChildNode | null = node.nextSibling;
		if (node instanceof HTMLElement) {
			quotedParts.push(node.outerHTML);
		} else {
			const text = node.textContent ?? "";
			if (text.trim()) {
				quotedParts.push(text);
			}
		}
		node.parentNode?.removeChild(node);
		node = next;
	}

	trimTrailingEmptyNodes(root);

	const visibleHtml = root.innerHTML.trim();
	const quotedHtml = quotedParts.join("").trim();

	return {
		visibleHtml: visibleHtml || html,
		quotedHtml: quotedHtml || null,
	};
}
