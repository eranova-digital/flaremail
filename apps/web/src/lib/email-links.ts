const BLOCKED_PROTOCOL_PATTERN = /^(javascript|data|vbscript):/i;

export function isNavigableEmailLink(href: string | null): href is string {
	if (!href) {
		return false;
	}

	const trimmed = href.trim();
	if (!trimmed || trimmed === "#") {
		return false;
	}

	return !BLOCKED_PROTOCOL_PATTERN.test(trimmed);
}

export function findEmailLinkFromEvent(
	target: EventTarget | null,
): HTMLAnchorElement | null {
	if (!(target instanceof Element)) {
		return null;
	}

	const anchor = target.closest("a");
	return anchor instanceof HTMLAnchorElement ? anchor : null;
}

export function openEmailLinkInNewTab(href: string): void {
	window.open(href, "_blank", "noopener,noreferrer");
}
