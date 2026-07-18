/**
 * Prefer `<body>` contents (plus `<head>` styles) when the file is a full HTML
 * document. Workers have no DOMParser, so this uses lightweight regex extraction.
 */
export function htmlFromUploadedText(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) {
		return "";
	}

	if (!/<html[\s>]|<body[\s>]/i.test(trimmed)) {
		return trimmed;
	}

	const styles = [...trimmed.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)]
		.map((match) => match[0])
		.join("\n");
	const bodyMatch = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(trimmed);
	const bodyHtml = (bodyMatch?.[1] ?? trimmed).trim();
	return [styles, bodyHtml].filter(Boolean).join("\n");
}
