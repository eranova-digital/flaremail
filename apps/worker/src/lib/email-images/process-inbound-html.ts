import type { NewMessageExternalImage } from "../../db/schema";
import {
	getOrFetchCachedImage,
	toMessageExternalImageRow,
} from "./cache-image";
import {
	buildImageReplacements,
	extractExternalImageUrls,
	rewriteExternalImageUrls,
} from "./rewrite-html";

export type ProcessInboundHtmlImagesResult = {
	html: string;
	externalImages: NewMessageExternalImage[];
};

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
