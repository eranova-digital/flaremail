const STRUCTURAL_SELECTOR =
	"table, img, hr, style, button, video, audio, iframe, svg, picture, figure, ul, ol";

const LAYOUT_STYLE_PATTERN =
	/(?:^|[;{\s])(?:background(?:-color|-image)?|width|max-width|min-width|height|max-height|min-height)\s*:/;

const LAYOUT_DISPLAY_PATTERN = /display\s*:\s*(?:flex|grid|table|inline-block)/;

const LAYOUT_POSITION_PATTERN = /position\s*:\s*(?:absolute|fixed|sticky)/;

/**
 * Determines whether an HTML email body has real visual structure (tables,
 * images, layout styling) as opposed to plain text that a mail client merely
 * wrapped in cosmetic tags (e.g. Gmail's `<div dir="ltr">`, `<blockquote>`,
 * `<br>`, mailto `<a>`). Structural messages should render full-width; the rest
 * are treated like plain text.
 */
export function isStructuralHtml(html?: string | null): boolean {
	if (!html) {
		return false;
	}

	const doc = new DOMParser().parseFromString(html, "text/html");

	if (doc.querySelector(STRUCTURAL_SELECTOR)) {
		return true;
	}

	for (const element of doc.querySelectorAll("[style]")) {
		const style = element.getAttribute("style")?.toLowerCase() ?? "";
		if (
			LAYOUT_STYLE_PATTERN.test(style) ||
			LAYOUT_DISPLAY_PATTERN.test(style) ||
			LAYOUT_POSITION_PATTERN.test(style)
		) {
			return true;
		}
	}

	return false;
}
