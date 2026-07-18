import {
	COMPOSE_ELEMENT_STYLES,
	COMPOSE_HTML_ATTR,
	createInlineImageContentId,
	inlineImageAttachmentFilename,
	mergeGmailQuoteClass,
	normalizeEmptyParagraphsInHtml,
	parseDataUrl,
	setStyleIfMissing,
	WORKER_COMPOSE_HTML_PREPARE_RULES,
	imageStyle,
} from "@test-worker/email-html-prepare";

import type { OutboundAttachmentInput } from "./outbound-attachments";
import type { OutboundMessageBody } from "./outbound-payload";

type InlineEmailAttachment = OutboundAttachmentInput & {
	disposition: "inline";
	contentId: string;
};

export async function prepareEmailHtml(html: string): Promise<{
	html: string;
	inlineAttachments: InlineEmailAttachment[];
}> {
	const inlineAttachments: InlineEmailAttachment[] = [];
	let imageIndex = 0;

	let rewriter = new HTMLRewriter();

	for (const rule of WORKER_COMPOSE_HTML_PREPARE_RULES) {
		switch (rule.kind) {
			case "unwrap-compose-html":
				rewriter = rewriter.on(`div[${COMPOSE_HTML_ATTR}]`, {
					element(element) {
						// Unwrap editor chrome; author markup (and its styles) stay intact.
						element.removeAndKeepContent();
					},
				});
				break;
			case "inline-data-url-images":
				rewriter = rewriter.on("img", {
					element(element) {
						const src = element.getAttribute("src") ?? "";
						let contentId = element.getAttribute("data-cid");

						if (src.startsWith("data:")) {
							const parsed = parseDataUrl(src);
							if (!parsed) {
								return;
							}

							contentId = contentId ?? createInlineImageContentId();
							inlineAttachments.push({
								filename: inlineImageAttachmentFilename(
									imageIndex + 1,
									parsed.mimeType,
								),
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
				});
				break;
			case "default-style":
				rewriter = rewriter.on(rule.target, {
					element(element) {
						setStyleIfMissing(
							element,
							COMPOSE_ELEMENT_STYLES[rule.target],
						);
					},
				});
				break;
			case "blockquote":
				rewriter = rewriter.on("blockquote", {
					element(element) {
						setStyleIfMissing(element, COMPOSE_ELEMENT_STYLES.blockquote);

						if (
							rule.gmailQuoteOnCite &&
							element.getAttribute("type") === "cite"
						) {
							element.setAttribute(
								"class",
								mergeGmailQuoteClass(element.getAttribute("class")),
							);
						}
					},
				});
				break;
			case "normalize-empty-paragraphs":
				break;
		}
	}

	const transformed = await rewriter.transform(new Response(html)).text();

	return {
		html: normalizeEmptyParagraphsInHtml(transformed),
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
