const EMPTY_EDITOR_HTML = "<p></p>";

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function plainTextToHtml(text: string): string {
	if (!text.trim()) {
		return EMPTY_EDITOR_HTML;
	}

	return text
		.split(/\n\n+/)
		.map((paragraph) => {
			const inner = paragraph
				.split("\n")
				.map((line) => escapeHtml(line))
				.join("<br>");
			return `<p>${inner}</p>`;
		})
		.join("");
}

export function isEmptyEditorHtml(html: string): boolean {
	const trimmed = html.trim();
	return (
		!trimmed ||
		trimmed === EMPTY_EDITOR_HTML ||
		trimmed === "<p><br></p>" ||
		trimmed === "<p><br class=\"ProseMirror-trailingBreak\"></p>"
	);
}

export function composeBodyFromMessage(message: {
	text?: string | null;
	html?: string | null;
	preview?: string | null;
}): { body: string; bodyHtml: string } {
	const body = message.text ?? message.preview ?? "";
	const bodyHtml = message.html?.trim()
		? message.html
		: plainTextToHtml(body);

	return { body, bodyHtml };
}

export function composeBodyHasContent(body: string, bodyHtml: string): boolean {
	return Boolean(body.trim()) || !isEmptyEditorHtml(bodyHtml);
}
