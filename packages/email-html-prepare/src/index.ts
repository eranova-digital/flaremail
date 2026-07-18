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
