/** Shared compose → outbound HTML prepare constants and pure helpers. */

export const COMPOSE_HTML_ATTR = "data-compose-html";

export const TABLE_STYLE =
	"border-collapse:collapse;width:100%;margin:12px 0;table-layout:fixed;";
export const CELL_STYLE =
	"border:1px solid #d1d5db;padding:8px;vertical-align:top;";
export const HEADER_CELL_STYLE =
	"border:1px solid #d1d5db;padding:8px;vertical-align:top;background-color:#f3f4f6;font-weight:600;";
export const LINK_STYLE = "color:#2563eb;text-decoration:underline;";
export const PARAGRAPH_STYLE = "margin:0 0 1em 0;";
export const BLOCKQUOTE_STYLE =
	"margin:0 0 0 0.8ex;border-left:1px solid #ccc;padding-left:1ex;color:#555;";

/** Default inline styles applied when an element has no existing style attribute. */
export const COMPOSE_ELEMENT_STYLES = {
	table: TABLE_STYLE,
	td: CELL_STYLE,
	th: HEADER_CELL_STYLE,
	a: LINK_STYLE,
	p: PARAGRAPH_STYLE,
	blockquote: BLOCKQUOTE_STYLE,
} as const;

export type ComposeHtmlStyleTarget = keyof typeof COMPOSE_ELEMENT_STYLES;

export type ComposeHtmlPrepareRule =
	| { kind: "unwrap-compose-html" }
	| { kind: "inline-data-url-images" }
	| {
			kind: "default-style";
			target: ComposeHtmlStyleTarget;
	  }
	| {
			kind: "blockquote";
			gmailQuoteOnCite: boolean;
	  }
	| { kind: "normalize-empty-paragraphs" };

/** Shared prepare steps for the browser DOMParser adapter. */
export const WEB_COMPOSE_HTML_PREPARE_RULES: ComposeHtmlPrepareRule[] = [
	{ kind: "inline-data-url-images" },
	{ kind: "default-style", target: "table" },
	{ kind: "default-style", target: "td" },
	{ kind: "default-style", target: "th" },
	{ kind: "default-style", target: "a" },
	{ kind: "default-style", target: "p" },
	{ kind: "unwrap-compose-html" },
];

/** Shared prepare steps for the worker HTMLRewriter adapter. */
export const WORKER_COMPOSE_HTML_PREPARE_RULES: ComposeHtmlPrepareRule[] = [
	{ kind: "unwrap-compose-html" },
	{ kind: "inline-data-url-images" },
	{ kind: "default-style", target: "table" },
	{ kind: "default-style", target: "td" },
	{ kind: "default-style", target: "th" },
	{ kind: "default-style", target: "a" },
	{ kind: "blockquote", gmailQuoteOnCite: true },
	{ kind: "default-style", target: "p" },
	{ kind: "normalize-empty-paragraphs" },
];

export function parseDataUrl(
	src: string,
): { mimeType: string; content: string } | null {
	const match = /^data:([^;]+);base64,(.+)$/i.exec(src);
	if (!match) {
		return null;
	}

	return {
		mimeType: match[1]!,
		content: match[2]!,
	};
}

export function imageStyle(width: string | null, align: string | null): string {
	const styles = ["max-width:100%;height:auto;"];

	if (width) {
		const normalized = /^\d+$/.test(width) ? `${width}px` : width;
		styles.push(`width:${normalized};`);
	}

	if (align === "center") {
		styles.push("display:block;margin-left:auto;margin-right:auto;");
	} else if (align === "right") {
		styles.push("display:block;margin-left:auto;margin-right:0;");
	} else {
		styles.push("display:block;");
	}

	return styles.join("");
}

export function extensionForMime(mimeType: string): string {
	const subtype = mimeType.split("/")[1]?.split("+")[0] ?? "bin";
	return subtype === "jpeg" ? "jpg" : subtype;
}

export function setStyleIfMissing(
	element: {
		getAttribute(name: string): string | null;
		setAttribute(name: string, value: string): void;
	},
	style: string,
) {
	if (element.getAttribute("style")?.trim()) {
		return;
	}
	element.setAttribute("style", style);
}

export function createInlineImageContentId(): string {
	return `img-${crypto.randomUUID()}@flaremail`;
}

export function inlineImageAttachmentFilename(
	imageIndex: number,
	mimeType: string,
): string {
	return `inline-image-${imageIndex + 1}.${extensionForMime(mimeType)}`;
}

export function isVisuallyEmptyParagraph(
	textContent: string | null | undefined,
	hasEmbeddedContent: boolean,
): boolean {
	return (
		!textContent?.replace(/\u00a0/g, " ").trim() && !hasEmbeddedContent
	);
}

export function normalizeEmptyParagraphsInHtml(html: string): string {
	const emptyParagraphPattern = new RegExp(
		`<p style="${escapeRegExp(PARAGRAPH_STYLE)}">\\s*<\\/p>`,
		"g",
	);
	return html.replace(
		emptyParagraphPattern,
		`<p style="${PARAGRAPH_STYLE}">&nbsp;</p>`,
	);
}

export function mergeGmailQuoteClass(existingClass: string | null | undefined) {
	const classes = new Set((existingClass ?? "").split(/\s+/).filter(Boolean));
	classes.add("gmail_quote");
	return Array.from(classes).join(" ");
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
