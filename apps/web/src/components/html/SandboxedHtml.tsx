import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

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
		isDark?: boolean;
	} = {},
): string {
	const adaptToTheme = options.adaptToTheme ?? true;
	const foreground = options.foreground ?? (options.isDark ? "#fafafa" : "#0a0a0a");
	const colorScheme = adaptToTheme
		? options.isDark
			? "dark"
			: "light"
		: "light";

	const themeCss = adaptToTheme
		? `html, body { margin: 0; padding: 0; background: transparent; color: ${foreground}; font: inherit; color-scheme: ${colorScheme}; }`
		: "html, body { margin: 0; padding: 0; background: #ffffff; color: #0a0a0a; font: inherit; color-scheme: light; }";

	const resetCss = [
		themeCss,
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
		`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' https: http: data: blob:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'" />`,
		`<style>${resetCss}</style>`,
		"</head><body>",
		html,
		"</body></html>",
	].join("");
}

function measureIframeHeight(iframe: HTMLIFrameElement): number {
	try {
		const doc = iframe.contentDocument;
		if (!doc?.documentElement) {
			return 0;
		}
		const body = doc.body;
		const root = doc.documentElement;
		return Math.ceil(
			Math.max(
				body?.scrollHeight ?? 0,
				body?.offsetHeight ?? 0,
				root.scrollHeight,
				root.offsetHeight,
			),
		);
	} catch {
		return 0;
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
	const [height, setHeight] = useState(128);
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
		const foreground =
			hostRef.current
				? getComputedStyle(hostRef.current).color
				: undefined;
		return buildSandboxedHtmlSrcDoc(html, bodyCss, {
			adaptToTheme,
			foreground,
			isDark,
		});
		// themeTick forces rebuild when .dark toggles
		// eslint-disable-next-line react-hooks/exhaustive-deps -- host color read at build time
	}, [html, bodyCss, adaptToTheme, themeTick]);

	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe || !srcDoc) {
			return;
		}

		const syncHeight = () => {
			const next = measureIframeHeight(iframe);
			if (next > 0) {
				setHeight(next);
			}
		};

		const onLoad = () => {
			syncHeight();
			const doc = iframe.contentDocument;
			if (!doc?.body) {
				return;
			}
			const typed = iframe as IframeWithObserver;
			typed._sandboxedResizeObserver?.disconnect();
			const observer = new ResizeObserver(() => syncHeight());
			observer.observe(doc.body);
			observer.observe(doc.documentElement);
			typed._sandboxedResizeObserver = observer;
		};

		iframe.addEventListener("load", onLoad);
		if (iframe.contentDocument?.readyState === "complete") {
			onLoad();
		}

		return () => {
			iframe.removeEventListener("load", onLoad);
			const typed = iframe as IframeWithObserver;
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
				style={{ height }}
				className={cn("bg-transparent w-full border-0", className)}
			/>
		</div>
	);
}
