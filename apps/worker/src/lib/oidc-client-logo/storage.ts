import { deleteR2Objects } from "../r2-cleanup";
import type { ProcessedProfilePicture } from "../profile-picture/process";
import {
	allOidcClientLogoKeys,
	oidcClientLogoStorageKey,
	type OidcClientLogoSize,
} from "./keys";

export async function storeOidcClientLogoVariants(
	bucket: R2Bucket,
	clientRecordId: string,
	variants: ProcessedProfilePicture,
): Promise<void> {
	await Promise.all([
		bucket.put(
			oidcClientLogoStorageKey(clientRecordId, "small"),
			variants.small,
			{ httpMetadata: { contentType: "image/webp" } },
		),
		bucket.put(
			oidcClientLogoStorageKey(clientRecordId, "large"),
			variants.large,
			{ httpMetadata: { contentType: "image/webp" } },
		),
	]);
}

export async function deleteOidcClientLogoObjects(
	bucket: R2Bucket,
	clientRecordId: string,
): Promise<void> {
	await deleteR2Objects(bucket, allOidcClientLogoKeys(clientRecordId));
}

export async function getOidcClientLogoObject(
	bucket: R2Bucket,
	clientRecordId: string,
	size: OidcClientLogoSize,
): Promise<R2ObjectBody | null> {
	return bucket.get(oidcClientLogoStorageKey(clientRecordId, size));
}
