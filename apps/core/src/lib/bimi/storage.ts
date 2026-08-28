import { deleteR2Objects } from "../r2-cleanup";
import {
	allBimiLogoKeys,
	bimiLogoStorageKey,
	type BimiLogoSize,
} from "./keys";
import type { ProcessedBimiLogo } from "./process-logo";

export async function storeBimiLogoVariants(
	bucket: R2Bucket,
	domain: string,
	variants: ProcessedBimiLogo,
): Promise<void> {
	await Promise.all([
		bucket.put(bimiLogoStorageKey(domain, "small"), variants.small, {
			httpMetadata: { contentType: "image/webp" },
		}),
		bucket.put(bimiLogoStorageKey(domain, "large"), variants.large, {
			httpMetadata: { contentType: "image/webp" },
		}),
	]);
}

export async function deleteBimiLogoObjects(
	bucket: R2Bucket,
	domain: string,
): Promise<void> {
	await deleteR2Objects(bucket, allBimiLogoKeys(domain));
}

export async function getBimiLogoObject(
	bucket: R2Bucket,
	domain: string,
	size: BimiLogoSize,
): Promise<R2ObjectBody | null> {
	return bucket.get(bimiLogoStorageKey(domain, size));
}
