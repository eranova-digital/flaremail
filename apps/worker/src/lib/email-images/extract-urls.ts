import {
	isExternalImageUrl,
	normalizeImageUrl,
	parseSrcsetUrls,
} from "./url";

const CSS_URL_PATTERN = /url\(\s*(['"]?)(https?:\/\/[^'")]+)\1\s*\)/gi;

export function extractExternalImageUrls(html: string): string[] {
	const urls = new Set<string>();

	for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
		const tag = match[0] ?? "";
		const src = /(?:\ssrc\s*=|\ssrc=)\s*(['"])(.*?)\1/i.exec(tag)?.[2];
		if (src && isExternalImageUrl(src)) {
			const normalized = normalizeImageUrl(src);
			if (normalized) {
				urls.add(normalized);
			}
		}

		const srcset = /(?:\ssrcset\s*=|\ssrcset=)\s*(['"])(.*?)\1/i.exec(tag)?.[2];
		if (srcset) {
			for (const candidate of parseSrcsetUrls(srcset)) {
				if (!isExternalImageUrl(candidate)) {
					continue;
				}
				const normalized = normalizeImageUrl(candidate);
				if (normalized) {
					urls.add(normalized);
				}
			}
		}
	}

	for (const match of html.matchAll(CSS_URL_PATTERN)) {
		const candidate = match[2];
		if (!candidate || !isExternalImageUrl(candidate)) {
			continue;
		}
		const normalized = normalizeImageUrl(candidate);
		if (normalized) {
			urls.add(normalized);
		}
	}

	return [...urls];
}

export function rewriteCssImageUrls(
	html: string,
	replaceUrl: (url: string) => string | null,
): string {
	return html.replace(CSS_URL_PATTERN, (fullMatch, quote: string, url: string) => {
		const nextUrl = replaceUrl(url);
		if (!nextUrl) {
			return fullMatch;
		}
		return `url(${quote}${nextUrl}${quote})`;
	});
}
