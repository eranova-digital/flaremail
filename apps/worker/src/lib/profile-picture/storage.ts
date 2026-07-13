import { deleteR2Objects } from "../r2-cleanup";
import {
	allProfilePictureKeys,
	profilePictureStorageKey,
	type ProfilePictureSize,
} from "./keys";
import type { ProcessedProfilePicture } from "./process";

export async function storeProfilePictureVariants(
	bucket: R2Bucket,
	accountId: string,
	variants: ProcessedProfilePicture,
): Promise<void> {
	await Promise.all([
		bucket.put(profilePictureStorageKey(accountId, "small"), variants.small, {
			httpMetadata: { contentType: "image/webp" },
		}),
		bucket.put(profilePictureStorageKey(accountId, "large"), variants.large, {
			httpMetadata: { contentType: "image/webp" },
		}),
	]);
}

export async function deleteProfilePictureObjects(
	bucket: R2Bucket,
	accountId: string,
): Promise<void> {
	await deleteR2Objects(bucket, allProfilePictureKeys(accountId));
}

export async function getProfilePictureObject(
	bucket: R2Bucket,
	accountId: string,
	size: ProfilePictureSize,
): Promise<R2ObjectBody | null> {
	return bucket.get(profilePictureStorageKey(accountId, size));
}
