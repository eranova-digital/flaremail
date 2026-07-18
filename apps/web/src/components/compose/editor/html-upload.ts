/** Prefer `<body>` contents when the file is a full HTML document. */
export function htmlFromUploadedText(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) {
		return "";
	}

	if (!/<html[\s>]|<body[\s>]/i.test(trimmed)) {
		return trimmed;
	}

	const doc = new DOMParser().parseFromString(trimmed, "text/html");
	const styles = [...doc.querySelectorAll("head style")]
		.map((el) => el.outerHTML)
		.join("\n");
	const bodyHtml = doc.body.innerHTML.trim();
	return [styles, bodyHtml].filter(Boolean).join("\n");
}
