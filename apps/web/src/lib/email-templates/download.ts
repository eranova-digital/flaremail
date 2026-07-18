/** Trigger a browser download for text content as a file. */
export function downloadTextFile(filename: string, contents: string, mimeType = "text/html;charset=utf-8") {
	const blob = new Blob([contents], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.rel = "noopener";
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

/** Sanitize a template name into a safe .html filename. */
export function htmlDownloadFilename(name: string, fallback = "template"): string {
	const base = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return `${base || fallback}.html`;
}
