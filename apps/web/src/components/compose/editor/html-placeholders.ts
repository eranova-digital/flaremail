export const COMPOSE_HTML_VALUES_ATTR = "data-compose-html-values";

const HTML_PLACEHOLDER_RE = /\{([A-Za-z0-9_]+)\}/g;

/** Unique `{name}`-style placeholders in appearance order. */
export function findHtmlPlaceholders(html: string): string[] {
	const seen = new Set<string>();
	const ordered: string[] = [];

	for (const match of html.matchAll(HTML_PLACEHOLDER_RE)) {
		const name = match[1];
		if (!name || seen.has(name)) {
			continue;
		}
		seen.add(name);
		ordered.push(name);
	}

	return ordered;
}

export function blankHtmlPlaceholders(
	html: string,
	values: Record<string, string>,
): string[] {
	return findHtmlPlaceholders(html).filter(
		(name) => !(values[name] ?? "").trim(),
	);
}

export function applyHtmlPlaceholders(
	html: string,
	values: Record<string, string>,
): string {
	let result = html;

	for (const name of findHtmlPlaceholders(html)) {
		const value = values[name] ?? "";
		if (!value.trim()) {
			continue;
		}

		result = result.replaceAll(`{${name}}`, value);
	}

	return result;
}

export function parseHtmlPlaceholderValues(
	raw: string | null | undefined,
): Record<string, string> {
	if (!raw) {
		return {};
	}

	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}

		const values: Record<string, string> = {};
		for (const [key, value] of Object.entries(parsed)) {
			if (typeof value === "string") {
				values[key] = value;
			}
		}
		return values;
	} catch {
		return {};
	}
}

export function serializeHtmlPlaceholderValues(
	values: Record<string, string>,
): string | null {
	const pruned: Record<string, string> = {};
	for (const [key, value] of Object.entries(values)) {
		if (value.trim()) {
			pruned[key] = value;
		}
	}

	return Object.keys(pruned).length > 0 ? JSON.stringify(pruned) : null;
}

export function pruneHtmlPlaceholderValues(
	values: Record<string, string>,
	placeholders: readonly string[],
): Record<string, string> {
	const next: Record<string, string> = {};
	for (const name of placeholders) {
		if (name in values) {
			next[name] = values[name] ?? "";
		}
	}
	return next;
}

/**
 * Apply stored `{var}` values inside compose HTML blocks for outbound mail.
 * Draft HTML keeps templates + values attrs; call this only when sending.
 */
export function resolveComposeHtmlDocument(
	html: string,
	composeHtmlAttr: string,
): string {
	if (!html.includes(composeHtmlAttr)) {
		return html;
	}

	const doc = new DOMParser().parseFromString(html, "text/html");
	const blocks = doc.querySelectorAll(`div[${composeHtmlAttr}]`);
	if (blocks.length === 0) {
		return html;
	}

	for (const block of blocks) {
		const values = parseHtmlPlaceholderValues(
			block.getAttribute(COMPOSE_HTML_VALUES_ATTR),
		);
		block.innerHTML = applyHtmlPlaceholders(block.innerHTML, values);
		block.removeAttribute(COMPOSE_HTML_VALUES_ATTR);
	}

	return doc.body.innerHTML;
}
