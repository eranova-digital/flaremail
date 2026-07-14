import type { NewMessageExternalImage } from "../../db/schema";
import { imageCacheKeyForUrl } from "./cache-key";
import { fetchRemoteImage, RemoteImageFetchError } from "./fetch-remote-image";
import { normalizeImageUrl } from "./url";

export type CachedRemoteImage = {
	sourceUrl: string;
	cacheKey: string;
	mimeType: string;
	sizeBytes: number;
	fetched: boolean;
};

export async function getOrFetchCachedImage(
	bucket: R2Bucket,
	rawUrl: string,
): Promise<CachedRemoteImage> {
	const normalized = normalizeImageUrl(rawUrl);
	if (!normalized) {
		throw new RemoteImageFetchError("Invalid image URL");
	}

	const cacheKey = await imageCacheKeyForUrl(normalized);
	if (!cacheKey) {
		throw new RemoteImageFetchError("Invalid image URL");
	}

	const existing = await bucket.head(cacheKey);
	if (existing) {
		return {
			sourceUrl: normalized,
			cacheKey,
			mimeType:
				existing.httpMetadata?.contentType?.split(";")[0]?.trim().toLowerCase() ??
				"application/octet-stream",
			sizeBytes: existing.size,
			fetched: true,
		};
	}

	try {
		const fetched = await fetchRemoteImage(normalized);
		await bucket.put(cacheKey, fetched.body, {
			httpMetadata: {
				contentType: fetched.mimeType,
			},
		});

		return {
			sourceUrl: normalized,
			cacheKey,
			mimeType: fetched.mimeType,
			sizeBytes: fetched.body.byteLength,
			fetched: true,
		};
	} catch (error) {
		console.warn(`Failed to prefetch external image ${normalized}:`, error);
		return {
			sourceUrl: normalized,
			cacheKey,
			mimeType: "application/octet-stream",
			sizeBytes: 0,
			fetched: false,
		};
	}
}

export function toMessageExternalImageRow(
	messageId: string,
	image: CachedRemoteImage,
): NewMessageExternalImage {
	return {
		id: crypto.randomUUID(),
		messageId,
		sourceUrl: image.sourceUrl,
		cacheKey: image.cacheKey,
		mimeType: image.mimeType,
		sizeBytes: image.sizeBytes,
		fetched: image.fetched,
	};
}

export async function ensureCachedImageAvailable(
	bucket: R2Bucket,
	row: Pick<
		NewMessageExternalImage,
		"sourceUrl" | "cacheKey" | "mimeType" | "sizeBytes" | "fetched"
	>,
): Promise<{ cacheKey: string; mimeType: string; body: R2ObjectBody } | null> {
	const cacheKey =
		row.cacheKey ?? (await imageCacheKeyForUrl(row.sourceUrl));
	if (!cacheKey) {
		return null;
	}

	const cached = await bucket.get(cacheKey);
	if (cached) {
		return {
			cacheKey,
			mimeType: row.mimeType,
			body: cached,
		};
	}

	try {
		const refreshed = await getOrFetchCachedImage(bucket, row.sourceUrl);
		if (!refreshed.fetched) {
			return null;
		}

		const object = await bucket.get(refreshed.cacheKey);
		if (!object) {
			return null;
		}

		return {
			cacheKey: refreshed.cacheKey,
			mimeType: refreshed.mimeType,
			body: object,
		};
	} catch {
		return null;
	}
}
