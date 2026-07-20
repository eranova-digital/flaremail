import type { NewMessageExternalImage } from "../../db/schema";
import {
	getOrFetchCachedImage,
	isExternalImageUrl,
	normalizeImageUrl,
	parseSrcsetUrls,
	rewriteSrcset,
	toMessageExternalImageRow,
} from "./cache-image";

export type ProcessInboundHtmlImagesResult = {
	html: string;
	externalImages: NewMessageExternalImage[];
};

export function messageExternalImageProxyPath(
	messageId: string,
	imageId: string,
): string {
	return `/api/v1/messages/${messageId}/images/${imageId}`;
}

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

function rewriteCssImageUrls(
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

type ImageReplacement = {
	sourceUrl: string;
	proxyPath: string;
};

function buildReplacementLookup(
	replacements: ImageReplacement[],
): Map<string, string> {
	const lookup = new Map<string, string>();
	for (const replacement of replacements) {
		lookup.set(replacement.sourceUrl, replacement.proxyPath);
	}
	return lookup;
}

function replaceKnownUrl(
	rawUrl: string,
	lookup: Map<string, string>,
): string | null {
	const normalized = normalizeImageUrl(rawUrl);
	if (!normalized) {
		return null;
	}
	return lookup.get(normalized) ?? null;
}

class ImageTagRewriter {
	constructor(private readonly lookup: Map<string, string>) {}

	element(element: Element) {
		const src = element.getAttribute("src");
		if (src) {
			const replacement = replaceKnownUrl(src, this.lookup);
			if (replacement) {
				element.setAttribute("src", replacement);
			}
		}

		const srcset = element.getAttribute("srcset");
		if (srcset) {
			const rewritten = rewriteSrcset(srcset, (url) =>
				replaceKnownUrl(url, this.lookup),
			);
			if (rewritten) {
				element.setAttribute("srcset", rewritten);
			}
		}
	}
}

export async function rewriteExternalImageUrls(
	html: string,
	replacements: ImageReplacement[],
): Promise<string> {
	if (replacements.length === 0) {
		return html;
	}

	const lookup = buildReplacementLookup(replacements);
	const rewriter = new HTMLRewriter().on(
		"img",
		new ImageTagRewriter(lookup),
	);

	const rewritten = await rewriter
		.transform(new Response(html, { headers: { "Content-Type": "text/html" } }))
		.text();

	return rewriteCssImageUrls(rewritten, (url) => replaceKnownUrl(url, lookup));
}

export function buildImageReplacements(
	messageId: string,
	images: Array<{ id: string; sourceUrl: string }>,
): ImageReplacement[] {
	return images.map((image) => ({
		sourceUrl: image.sourceUrl,
		proxyPath: messageExternalImageProxyPath(messageId, image.id),
	}));
}

export async function processInboundHtmlImages(
	html: string,
	messageId: string,
	bucket: R2Bucket,
): Promise<ProcessInboundHtmlImagesResult> {
	const sourceUrls = extractExternalImageUrls(html);
	if (sourceUrls.length === 0) {
		return { html, externalImages: [] };
	}

	const cachedByUrl = new Map<
		string,
		Awaited<ReturnType<typeof getOrFetchCachedImage>>
	>();

	await Promise.all(
		sourceUrls.map(async (sourceUrl) => {
			const cached = await getOrFetchCachedImage(bucket, sourceUrl);
			cachedByUrl.set(sourceUrl, cached);
		}),
	);

	const externalImages = sourceUrls.map((sourceUrl) => {
		const cached = cachedByUrl.get(sourceUrl);
		if (!cached) {
			throw new Error(`Missing cache entry for ${sourceUrl}`);
		}
		return toMessageExternalImageRow(messageId, cached);
	});

	const replacements = buildImageReplacements(messageId, externalImages);
	const rewrittenHtml = await rewriteExternalImageUrls(html, replacements);

	return {
		html: rewrittenHtml,
		externalImages,
	};
}
