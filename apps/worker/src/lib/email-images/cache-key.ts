import { IMAGE_CACHE_KEY_PREFIX } from "./constants";
import { hashImageUrl } from "./hash-url";

export async function imageCacheKeyForUrl(rawUrl: string): Promise<string | null> {
	const hash = await hashImageUrl(rawUrl);
	if (!hash) {
		return null;
	}

	return `${IMAGE_CACHE_KEY_PREFIX}/${hash}`;
}
