import type { OutboundAttachmentInput } from "./outbound-attachments";
import type { OutboundMessageBody } from "./outbound-payload";

const TABLE_STYLE =
	"border-collapse:collapse;width:100%;margin:12px 0;table-layout:fixed;";
const CELL_STYLE =
	"border:1px solid #d1d5db;padding:8px;vertical-align:top;";
const HEADER_CELL_STYLE =
	"border:1px solid #d1d5db;padding:8px;vertical-align:top;background-color:#f3f4f6;font-weight:600;";
const LINK_STYLE = "color:#2563eb;text-decoration:underline;";
const PARAGRAPH_STYLE = "margin:0 0 1em 0;";
// Inline the quote styling so receiving clients render the vertical quote bar.
// Mail clients strip `class` attributes, so a bare `<blockquote type="cite">`
// would otherwise show as plain (only browser-default) indented text.
const BLOCKQUOTE_STYLE =
	"margin:0 0 0 0.8ex;border-left:1px solid #ccc;padding-left:1ex;color:#555;";

type InlineEmailAttachment = OutboundAttachmentInput & {
	disposition: "inline";
	contentId: string;
};

function parseDataUrl(
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

function imageStyle(width: string | null, align: string | null): string {
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

function extensionForMime(mimeType: string): string {
	const subtype = mimeType.split("/")[1]?.split("+")[0] ?? "bin";
	return subtype === "jpeg" ? "jpg" : subtype;
}

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
				element.setAttribute("style", imageStyle(width, align));
				element.removeAttribute("data-align");
			},
		})
		.on("table", {
			element(element) {
				element.setAttribute("style", TABLE_STYLE);
			},
		})
		.on("td", {
			element(element) {
				element.setAttribute("style", CELL_STYLE);
			},
		})
		.on("th", {
			element(element) {
				element.setAttribute("style", HEADER_CELL_STYLE);
			},
		})
		.on("a", {
			element(element) {
				element.setAttribute("style", LINK_STYLE);
			},
		})
		.on("blockquote", {
			element(element) {
				element.setAttribute("style", BLOCKQUOTE_STYLE);

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
				element.setAttribute("style", PARAGRAPH_STYLE);
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
