import {
	CELL_STYLE,
	COMPOSE_HTML_ATTR,
	extensionForMime,
	HEADER_CELL_STYLE,
	imageStyle,
	LINK_STYLE,
	PARAGRAPH_STYLE,
	parseDataUrl,
	setStyleIfMissing,
	TABLE_STYLE,
} from "@test-worker/email-html-prepare";

import type { OutboundAttachmentInput } from "./outbound-attachments";
import type { OutboundMessageBody } from "./outbound-payload";

// Inline the quote styling so receiving clients render the vertical quote bar.
// Mail clients strip `class` attributes, so a bare `<blockquote type="cite">`
// would otherwise show as plain (only browser-default) indented text.
const BLOCKQUOTE_STYLE =
	"margin:0 0 0 0.8ex;border-left:1px solid #ccc;padding-left:1ex;color:#555;";

type InlineEmailAttachment = OutboundAttachmentInput & {
	disposition: "inline";
	contentId: string;
};

function normalizeEmptyParagraphs(html: string): string {
	return html.replace(
		/<p style="margin:0 0 1em 0;">\s*<\/p>/g,
		'<p style="margin:0 0 1em 0;">&nbsp;</p>',
	);
}

export async function prepareEmailHtml(html: string): Promise<{
	html: string;
	inlineAttachments: InlineEmailAttachment[];
}> {
	const inlineAttachments: InlineEmailAttachment[] = [];
	let imageIndex = 0;

	const rewriter = new HTMLRewriter()
		.on(`div[${COMPOSE_HTML_ATTR}]`, {
			element(element) {
				// Unwrap editor chrome; author markup (and its styles) stay intact.
				element.removeAndKeepContent();
			},
		})
		.on("img", {
			element(element) {
				const src = element.getAttribute("src") ?? "";
				let contentId = element.getAttribute("data-cid");

				if (src.startsWith("data:")) {
					const parsed = parseDataUrl(src);
					if (!parsed) {
						return;
					}

					contentId = contentId ?? `img-${crypto.randomUUID()}@flaremail`;
					inlineAttachments.push({
						filename: `inline-image-${imageIndex + 1}.${extensionForMime(parsed.mimeType)}`,
						mimeType: parsed.mimeType,
						content: parsed.content,
						disposition: "inline",
						contentId,
					});
					imageIndex += 1;
					element.setAttribute("src", `cid:${contentId}`);
					element.setAttribute("data-cid", contentId);
				}

				const width = element.getAttribute("width");
				const align = element.getAttribute("data-align");
				setStyleIfMissing(element, imageStyle(width, align));
				element.removeAttribute("data-align");
			},
		})
		.on("table", {
			element(element) {
				setStyleIfMissing(element, TABLE_STYLE);
			},
		})
		.on("td", {
			element(element) {
				setStyleIfMissing(element, CELL_STYLE);
			},
		})
		.on("th", {
			element(element) {
				setStyleIfMissing(element, HEADER_CELL_STYLE);
			},
		})
		.on("a", {
			element(element) {
				setStyleIfMissing(element, LINK_STYLE);
			},
		})
		.on("blockquote", {
			element(element) {
				setStyleIfMissing(element, BLOCKQUOTE_STYLE);

				// Tag reply quotes with Gmail's class so Gmail-family clients
				// recognize and collapse the quoted history under the "..." toggle.
				if (element.getAttribute("type") === "cite") {
					const existing = element.getAttribute("class") ?? "";
					const classes = new Set(
						existing.split(/\s+/).filter(Boolean),
					);
					classes.add("gmail_quote");
					element.setAttribute("class", Array.from(classes).join(" "));
				}
			},
		})
		.on("p", {
			element(element) {
				setStyleIfMissing(element, PARAGRAPH_STYLE);
			},
		});

	const transformed = await rewriter.transform(new Response(html)).text();

	return {
		html: normalizeEmptyParagraphs(transformed),
		inlineAttachments,
	};
}

export async function prepareOutboundMessageBody(
	body: OutboundMessageBody,
): Promise<OutboundMessageBody> {
	if (!body.html?.trim()) {
		return body;
	}

	const prepared = await prepareEmailHtml(body.html);
	return {
		...body,
		html: prepared.html,
		attachments: [...(body.attachments ?? []), ...prepared.inlineAttachments],
	};
}
