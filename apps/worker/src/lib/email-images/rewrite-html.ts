import {
	extractExternalImageUrls,
	rewriteCssImageUrls,
} from "./extract-urls";
import { messageExternalImageProxyPath } from "./proxy-path";
import { normalizeImageUrl, rewriteSrcset } from "./url";

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

export { extractExternalImageUrls };
