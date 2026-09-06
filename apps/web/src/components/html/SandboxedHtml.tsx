import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/** Matches the app UI (Tailwind preflight / `font-sans`) when host style is unavailable. */
const DEFAULT_BODY_FONT_FAMILY = "ui-sans-serif, system-ui, sans-serif";

type SandboxedHtmlProps = {
	html: string;
	title: string;
	className?: string;
	/** Extra CSS injected into the iframe document. */
	bodyCss?: string;
	/**
	 * When true, inherit the host theme (transparent canvas + foreground color).
	 * When false, use a light paper surface for structured HTML emails.
	 */
	adaptToTheme?: boolean;
};

/**
 * Renders untrusted HTML in a sandboxed iframe (no scripts).
 * Popups are allowed so http(s) links can open in a new tab.
 * `allow-same-origin` is required only to measure content height.
 */
export function buildSandboxedHtmlSrcDoc(
	html: string,
	bodyCss = "",
	options: {
		adaptToTheme?: boolean;
		foreground?: string;
		fontFamily?: string;
		isDark?: boolean;
	} = {},
): string {
	const adaptToTheme = options.adaptToTheme ?? true;
	const foreground = options.foreground ?? (options.isDark ? "#fafafa" : "#0a0a0a");
	// Iframe `font: inherit` does not pick up the host page — UA default is serif/Times.
	const fontFamily = options.fontFamily?.trim() || DEFAULT_BODY_FONT_FAMILY;
	const colorScheme = adaptToTheme
		? options.isDark
			? "dark"
			: "light"
		: "light";

	const themeCss = adaptToTheme
		? `html, body { margin: 0; padding: 0; height: auto !important; min-height: 0 !important; background: transparent; color: ${foreground}; font-family: ${fontFamily}; color-scheme: ${colorScheme}; }`
		: `html, body { margin: 0; padding: 0; height: auto !important; min-height: 0 !important; background: #ffffff; color: #0a0a0a; font-family: ${fontFamily}; color-scheme: light; }`;

	const resetCss = [
		themeCss,
		'table[role="presentation"], table[border="0"] { border: none !important; }',
		"a { color: #2563eb; }",
		"img { max-width: 100%; max-height: 20rem; height: auto; object-fit: contain; }",
		bodyCss,
	]
		.filter(Boolean)
		.join("\n");

	return [
		"<!DOCTYPE html>",
		"<html><head>",
		'<meta charset="utf-8" />',
		'<meta name="viewport" content="width=device-width, initial-scale=1" />',
		`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' https: http: data: blob:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'" />`,
		`<style>${resetCss}</style>`,
		"</head><body data-flaremail-html>",
		html,
		"</body></html>",
	].join("");
}

function measureIframeHeight(iframe: HTMLIFrameElement): number {
	try {
		const doc = iframe.contentDocument;
		if (!doc?.documentElement || !doc.body) {
			return 0;
		}
		const body = doc.body;
		const root = doc.documentElement;
		return Math.ceil(
			Math.max(
				body.scrollHeight,
				body.offsetHeight,
				root.scrollHeight,
				root.offsetHeight,
			),
		);
	} catch {
		return 0;
	}
}

function isSandboxedDocumentReady(iframe: HTMLIFrameElement): boolean {
	try {
		const doc = iframe.contentDocument;
		return Boolean(doc?.body?.hasAttribute("data-flaremail-html") && doc.readyState !== "loading");
	} catch {
		return false;
	}
}

type IframeWithObserver = HTMLIFrameElement & {
	_sandboxedResizeObserver?: ResizeObserver;
};

export function SandboxedHtml({
	html,
	title,
	className,
	bodyCss,
	adaptToTheme = true,
}: SandboxedHtmlProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const hostRef = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState(0);
	const [themeTick, setThemeTick] = useState(0);

	useEffect(() => {
		const root = document.documentElement;
		const observer = new MutationObserver(() => {
			setThemeTick((value) => value + 1);
		});
		observer.observe(root, { attributes: true, attributeFilter: ["class"] });
		return () => observer.disconnect();
	}, []);

	const srcDoc = useMemo(() => {
		if (!html.trim()) {
			return "";
		}
		const isDark = document.documentElement.classList.contains("dark");
		const hostStyle = hostRef.current
			? getComputedStyle(hostRef.current)
			: undefined;
		return buildSandboxedHtmlSrcDoc(html, bodyCss, {
			adaptToTheme,
			foreground: hostStyle?.color,
			fontFamily: hostStyle?.fontFamily,
			isDark,
		});
		// themeTick forces rebuild when .dark toggles
		// eslint-disable-next-line react-hooks/exhaustive-deps -- host color/font read at build time
	}, [html, bodyCss, adaptToTheme, themeTick]);

	useLayoutEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe || !srcDoc) {
			return;
		}

		let cancelled = false;
		let raf = 0;
		let measuring = false;
		const typed = iframe as IframeWithObserver;

		const syncHeight = () => {
			if (cancelled || measuring || !isSandboxedDocumentReady(iframe)) {
				return;
			}
			measuring = true;
			try {
				const next = measureIframeHeight(iframe);
				if (next > 0) {
					iframe.style.height = `${next}px`;
					setHeight((prev) => (prev === next ? prev : next));
				}
			} finally {
				measuring = false;
			}
		};

		const attach = () => {
			if (cancelled || !isSandboxedDocumentReady(iframe)) {
				return false;
			}
			const doc = iframe.contentDocument;
			if (!doc?.body) {
				return false;
			}
			typed._sandboxedResizeObserver?.disconnect();
			const observer = new ResizeObserver(() => syncHeight());
			observer.observe(doc.body);
			observer.observe(doc.documentElement);
			typed._sandboxedResizeObserver = observer;
			syncHeight();
			return true;
		};

		const poll = () => {
			if (cancelled) {
				return;
			}
			if (attach()) {
				return;
			}
			raf = requestAnimationFrame(poll);
		};

		iframe.addEventListener("load", attach);
		raf = requestAnimationFrame(poll);
		attach();

		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
			iframe.removeEventListener("load", attach);
			typed._sandboxedResizeObserver?.disconnect();
			delete typed._sandboxedResizeObserver;
		};
	}, [srcDoc]);

	if (!html.trim()) {
		return null;
	}

	return (
		<div ref={hostRef} className="text-foreground w-full">
			<iframe
				ref={iframeRef}
				title={title}
				sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
				referrerPolicy="no-referrer"
				srcDoc={srcDoc}
				style={{ height, overflow: "hidden", visibility: height > 0 ? "visible" : "hidden" }}
				className={cn("bg-transparent w-full border-0", className)}
			/>
		</div>
	);
}
