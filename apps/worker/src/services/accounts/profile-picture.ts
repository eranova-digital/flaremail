import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { accountProfiles, accounts } from "../../db/schema";
import { authorizeAccount } from "../../lib/auth/access";
import type { Principal } from "../../lib/auth/types";
import {
	deleteProfilePictureObjects,
	getProfilePictureObject,
	storeProfilePictureVariants,
} from "../../lib/profile-picture/storage";
import {
	parseProfilePictureSize,
	type ProfilePictureSize,
} from "../../lib/profile-picture/keys";
import { toProfilePicturePayload } from "../../lib/profile-picture/payload";

async function processUploadedProfilePicture(bytes: ArrayBuffer, mimeType: string) {
	const { processProfilePicture } = await import("../../lib/profile-picture/process");
	return processProfilePicture(bytes, mimeType);
}

async function assertCanEditProfilePicture(
	db: Database,
	principal: Principal,
	accountId: string,
) {
	const isSelf = principal.accountId === accountId;
	if (!isSelf) {
		await authorizeAccount(db, principal, accountId, "manage");
	}

	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!account) {
		throw new Error("Account not found");
	}
	if (account.isIntendant) {
		throw new Error("Intendant profile cannot be edited");
	}
}

export async function uploadProfilePictureForAccount(
	db: Database,
	bucket: R2Bucket,
	principal: Principal,
	accountId: string,
	file: File,
) {
	await assertCanEditProfilePicture(db, principal, accountId);

	const mimeType = file.type.trim().toLowerCase();
	const bytes = await file.arrayBuffer();
	const variants = await processUploadedProfilePicture(bytes, mimeType);

	try {
		await storeProfilePictureVariants(bucket, accountId, variants);

		const now = new Date();
		await db
			.update(accountProfiles)
			.set({ profilePictureUpdatedAt: now, updatedAt: now })
			.where(eq(accountProfiles.accountId, accountId));

		return { profilePicture: toProfilePicturePayload(now) };
	} catch (error) {
		await deleteProfilePictureObjects(bucket, accountId);
		throw error;
	}
}

export async function removeProfilePictureForAccount(
	db: Database,
	bucket: R2Bucket,
	principal: Principal,
	accountId: string,
) {
	await assertCanEditProfilePicture(db, principal, accountId);

	const [profile] = await db
		.select({ profilePictureUpdatedAt: accountProfiles.profilePictureUpdatedAt })
		.from(accountProfiles)
		.where(eq(accountProfiles.accountId, accountId))
		.limit(1);

	if (profile?.profilePictureUpdatedAt) {
		await deleteProfilePictureObjects(bucket, accountId);
	}

	const now = new Date();
	await db
		.update(accountProfiles)
		.set({ profilePictureUpdatedAt: null, updatedAt: now })
		.where(eq(accountProfiles.accountId, accountId));

	return { profilePicture: null };
}

export async function uploadProfilePicture(
	db: Database,
	bucket: R2Bucket,
	principal: Principal,
	file: File,
) {
	const accountId = principal.accountId;
	if (!accountId) {
		throw new Error("Authentication required");
	}

	return uploadProfilePictureForAccount(db, bucket, principal, accountId, file);
}

export async function removeProfilePicture(
	db: Database,
	bucket: R2Bucket,
	principal: Principal,
) {
	const accountId = principal.accountId;
	if (!accountId) {
		throw new Error("Authentication required");
	}

	return removeProfilePictureForAccount(db, bucket, principal, accountId);
}

export async function downloadProfilePicture(
	db: Database,
	bucket: R2Bucket,
	accountId: string,
	sizeParam: string | null,
): Promise<Response> {
	const size = parseProfilePictureSize(sizeParam);
	if (!size) {
		throw new Error("size must be small or large");
	}

	const [profile] = await db
		.select({ profilePictureUpdatedAt: accountProfiles.profilePictureUpdatedAt })
		.from(accountProfiles)
		.where(eq(accountProfiles.accountId, accountId))
		.limit(1);

	if (!profile?.profilePictureUpdatedAt) {
		throw new Error("Profile picture not found");
	}

	const object = await getProfilePictureObject(bucket, accountId, size);
	if (!object) {
		throw new Error("Profile picture not found");
	}

	const headers = new Headers();
	headers.set("Content-Type", "image/webp");
	headers.set("Cache-Control", "public, max-age=31536000, immutable");
	headers.set(
		"ETag",
		`"${profile.profilePictureUpdatedAt.toISOString()}-${size}"`,
	);

	return new Response(object.body, { headers });
}

export async function deleteAccountProfilePictures(
	db: Database,
	bucket: R2Bucket,
	accountId: string,
): Promise<void> {
	const [profile] = await db
		.select({ profilePictureUpdatedAt: accountProfiles.profilePictureUpdatedAt })
		.from(accountProfiles)
		.where(eq(accountProfiles.accountId, accountId))
		.limit(1);

	if (profile?.profilePictureUpdatedAt) {
		await deleteProfilePictureObjects(bucket, accountId);
	}
}

export function profilePictureFromProfile(
	profile: { profilePictureUpdatedAt: Date | null } | null | undefined,
) {
	return toProfilePicturePayload(profile?.profilePictureUpdatedAt ?? null);
}

export type { ProfilePictureSize };
