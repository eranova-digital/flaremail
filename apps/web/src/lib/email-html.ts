import {
	COMPOSE_ELEMENT_STYLES,
	COMPOSE_HTML_ATTR,
	createInlineImageContentId,
	inlineImageAttachmentFilename,
	isVisuallyEmptyParagraph,
	parseDataUrl,
	setStyleIfMissing,
	WEB_COMPOSE_HTML_PREPARE_RULES,
	imageStyle,
} from "@test-worker/email-html-prepare";
import type { OutboundAttachmentInput } from "@/lib/api/client";
import { fetchAttachmentBlob } from "@/lib/attachments";

export type InlineEmailAttachment = OutboundAttachmentInput & {
	disposition: "inline";
	contentId: string;
};

function normalizeContentId(contentId: string): string {
	return contentId.replace(/^<|>$/g, "").trim().toLowerCase();
}

function unwrapComposeHtmlBlocks(doc: Document) {
	for (const block of [
		...doc.querySelectorAll(`div[${COMPOSE_HTML_ATTR}]`),
	]) {
		const parent = block.parentNode;
		if (!parent) {
			continue;
		}
		while (block.firstChild) {
			parent.insertBefore(block.firstChild, block);
		}
		parent.removeChild(block);
	}
}

export function prepareEmailHtml(html: string): {
	html: string;
	inlineAttachments: InlineEmailAttachment[];
} {
	const doc = new DOMParser().parseFromString(html, "text/html");
	const inlineAttachments: InlineEmailAttachment[] = [];
	let imageIndex = 0;

	for (const rule of WEB_COMPOSE_HTML_PREPARE_RULES) {
		switch (rule.kind) {
			case "inline-data-url-images":
				doc.querySelectorAll("img").forEach((img) => {
					const src = img.getAttribute("src") ?? "";
					let contentId = img.getAttribute("data-cid");

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
						img.setAttribute("src", `cid:${contentId}`);
						img.setAttribute("data-cid", contentId);
					}

					const width = img.getAttribute("width");
					const align = img.getAttribute("data-align");
					setStyleIfMissing(img, imageStyle(width, align));
					img.removeAttribute("data-align");
				});
				break;
			case "default-style":
				if (rule.target === "p") {
					doc.querySelectorAll("p").forEach((paragraph) => {
						setStyleIfMissing(paragraph, COMPOSE_ELEMENT_STYLES.p);
						if (
							isVisuallyEmptyParagraph(
								paragraph.textContent,
								Boolean(
									paragraph.querySelector("img, br, table"),
								),
							)
						) {
							paragraph.innerHTML = "&nbsp;";
						}
					});
				} else {
					doc.querySelectorAll(rule.target).forEach((element) => {
						setStyleIfMissing(
							element,
							COMPOSE_ELEMENT_STYLES[rule.target],
						);
					});
				}
				break;
			case "unwrap-compose-html":
				unwrapComposeHtmlBlocks(doc);
				break;
		}
	}

	return {
		html: doc.body.innerHTML,
		inlineAttachments,
	};
}

export async function hydrateInlineImagesForEditor(
	html: string,
	attachments: Array<{
		id?: string;
		contentId?: string | null;
		disposition?: string | null;
	}>,
): Promise<string> {
	if (!html.includes("cid:")) {
		return html;
	}

	const inlineByCid = new Map<string, string>();
	for (const attachment of attachments) {
		if (
			attachment.disposition !== "inline" ||
			!attachment.contentId?.trim() ||
			!attachment.id
		) {
			continue;
		}

		inlineByCid.set(
			normalizeContentId(attachment.contentId),
			attachment.id,
		);
	}

	if (inlineByCid.size === 0) {
		return html;
	}

	const doc = new DOMParser().parseFromString(html, "text/html");
	const images = [...doc.querySelectorAll("img[src^='cid:']")];

	await Promise.all(
		images.map(async (img) => {
			const cid = normalizeContentId(img.getAttribute("src")!.slice(4));
			const attachmentId = inlineByCid.get(cid);
			if (!attachmentId) {
				return;
			}

			const blob = await fetchAttachmentBlob(attachmentId);
			const dataUrl = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result));
				reader.onerror = () => reject(reader.error);
				reader.readAsDataURL(blob);
			});
			img.setAttribute("src", dataUrl);
		}),
	);

	return doc.body.innerHTML;
}

export async function hydrateInlineImagesForDisplay(
	html: string,
	attachments: Array<{
		id?: string;
		contentId?: string | null;
		disposition?: string | null;
	}>,
): Promise<string> {
	return hydrateInlineImagesForEditor(html, attachments);
}
