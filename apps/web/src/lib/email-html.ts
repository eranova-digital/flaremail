import type { OutboundAttachmentInput } from "@/lib/api/client";
import { fetchAttachmentBlob } from "@/lib/attachments";

const COMPOSE_HTML_ATTR = "data-compose-html";

const TABLE_STYLE =
	"border-collapse:collapse;width:100%;margin:12px 0;table-layout:fixed;";
const CELL_STYLE =
	"border:1px solid #d1d5db;padding:8px;vertical-align:top;";
const HEADER_CELL_STYLE =
	"border:1px solid #d1d5db;padding:8px;vertical-align:top;background-color:#f3f4f6;font-weight:600;";
const LINK_STYLE = "color:#2563eb;text-decoration:underline;";
const PARAGRAPH_STYLE = "margin:0 0 1em 0;";

export type InlineEmailAttachment = OutboundAttachmentInput & {
	disposition: "inline";
	contentId: string;
};

function normalizeContentId(contentId: string): string {
	return contentId.replace(/^<|>$/g, "").trim().toLowerCase();
}

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

function setStyleIfMissing(element: Element, style: string) {
	if (element.getAttribute("style")?.trim()) {
		return;
	}
	element.setAttribute("style", style);
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

	doc.querySelectorAll("img").forEach((img, index) => {
		const src = img.getAttribute("src") ?? "";
		let contentId = img.getAttribute("data-cid");

		if (src.startsWith("data:")) {
			const parsed = parseDataUrl(src);
			if (!parsed) {
				return;
			}

			contentId = contentId ?? `img-${crypto.randomUUID()}@flaremail`;
			inlineAttachments.push({
				filename: `inline-image-${index + 1}.${extensionForMime(parsed.mimeType)}`,
				mimeType: parsed.mimeType,
				content: parsed.content,
				disposition: "inline",
				contentId,
			});
			img.setAttribute("src", `cid:${contentId}`);
			img.setAttribute("data-cid", contentId);
		}

		const width = img.getAttribute("width");
		const align = img.getAttribute("data-align");
		setStyleIfMissing(img, imageStyle(width, align));
		img.removeAttribute("data-align");
	});

	doc.querySelectorAll("table").forEach((table) => {
		setStyleIfMissing(table, TABLE_STYLE);
	});

	doc.querySelectorAll("td").forEach((cell) => {
		setStyleIfMissing(cell, CELL_STYLE);
	});

	doc.querySelectorAll("th").forEach((cell) => {
		setStyleIfMissing(cell, HEADER_CELL_STYLE);
	});

	doc.querySelectorAll("a").forEach((anchor) => {
		setStyleIfMissing(anchor, LINK_STYLE);
	});

	doc.querySelectorAll("p").forEach((paragraph) => {
		setStyleIfMissing(paragraph, PARAGRAPH_STYLE);
		if (
			!paragraph.textContent?.replace(/\u00a0/g, " ").trim() &&
			!paragraph.querySelector("img, br, table")
		) {
			paragraph.innerHTML = "&nbsp;";
		}
	});

	unwrapComposeHtmlBlocks(doc);

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
