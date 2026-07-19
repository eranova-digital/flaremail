import { useMemo } from "react";

import { cn } from "@/lib/utils";

type SandboxedHtmlProps = {
	html: string;
	title: string;
	className?: string;
	/** Extra CSS injected into the iframe document. */
	bodyCss?: string;
};

/**
 * Renders untrusted HTML in a sandboxed iframe (no scripts, no same-origin).
 * Popups are allowed so http(s) links can open in a new tab.
 */
export function buildSandboxedHtmlSrcDoc(
	html: string,
	bodyCss = "",
): string {
	const resetCss = [
		"html, body { margin: 0; padding: 0; background: transparent; color: inherit; font: inherit; }",
		'table[role="presentation"], table[border="0"] { border: none !important; }',
		"a { color: #2563eb; }",
		"img { max-width: 100%; height: auto; }",
		bodyCss,
	]
		.filter(Boolean)
		.join("\n");

	return [
		"<!DOCTYPE html>",
		"<html><head>",
		'<meta charset="utf-8" />',
		'<meta name="viewport" content="width=device-width, initial-scale=1" />',
		'<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src https: http: data: blob:; style-src \'unsafe-inline\'; font-src data:; base-uri \'none\'; form-action \'none\'" />',
		`<style>${resetCss}</style>`,
		"</head><body>",
		html,
		"</body></html>",
	].join("");
}

export function SandboxedHtml({
	html,
	title,
	className,
	bodyCss,
}: SandboxedHtmlProps) {
	const srcDoc = useMemo(
		() => (html.trim() ? buildSandboxedHtmlSrcDoc(html, bodyCss) : ""),
		[html, bodyCss],
	);

	if (!srcDoc) {
		return null;
	}

	return (
		<iframe
			title={title}
			sandbox="allow-popups allow-popups-to-escape-sandbox"
			referrerPolicy="no-referrer"
			srcDoc={srcDoc}
			className={cn("bg-transparent w-full border-0", className)}
		/>
	);
}
