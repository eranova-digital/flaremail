import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { oidcClients } from "../db/schema";
import {
	deleteOidcClientLogoObjects,
	getOidcClientLogoObject,
	storeOidcClientLogoVariants,
} from "../lib/oidc-client-logo/storage";
import { parseOidcClientLogoSize } from "../lib/oidc-client-logo/keys";
import { toProfilePicturePayload } from "../lib/profile-picture/payload";
import { getOidcClientRowById } from "./oidc-clients";

async function processUploadedLogo(bytes: ArrayBuffer, mimeType: string) {
	const { processProfilePicture } = await import(
		"../lib/profile-picture/process"
	);
	return processProfilePicture(bytes, mimeType);
}

export async function uploadOidcClientLogo(
	db: Database,
	bucket: R2Bucket,
	clientRecordId: string,
	file: File,
) {
	const existing = await getOidcClientRowById(db, clientRecordId);
	if (!existing) {
		throw new Error("OIDC client not found");
	}

	const mimeType = file.type.trim().toLowerCase();
	const bytes = await file.arrayBuffer();
	const variants = await processUploadedLogo(bytes, mimeType);

	try {
		await storeOidcClientLogoVariants(bucket, clientRecordId, variants);
		const now = new Date();
		await db
			.update(oidcClients)
			.set({ logoUpdatedAt: now, updatedAt: now })
			.where(eq(oidcClients.id, clientRecordId));
		return { logo: toProfilePicturePayload(now) };
	} catch (error) {
		await deleteOidcClientLogoObjects(bucket, clientRecordId);
		throw error;
	}
}

export async function removeOidcClientLogo(
	db: Database,
	bucket: R2Bucket,
	clientRecordId: string,
) {
	const existing = await getOidcClientRowById(db, clientRecordId);
	if (!existing) {
		throw new Error("OIDC client not found");
	}

	if (existing.logoUpdatedAt) {
		await deleteOidcClientLogoObjects(bucket, clientRecordId);
	}

	const now = new Date();
	await db
		.update(oidcClients)
		.set({ logoUpdatedAt: null, updatedAt: now })
		.where(eq(oidcClients.id, clientRecordId));

	return { logo: null };
}

export async function downloadOidcClientLogo(
	db: Database,
	bucket: R2Bucket,
	clientRecordId: string,
	sizeParam: string | null,
): Promise<Response> {
	const size = parseOidcClientLogoSize(sizeParam);
	if (!size) {
		throw new Error("size must be small or large");
	}

	const existing = await getOidcClientRowById(db, clientRecordId);
	if (!existing?.logoUpdatedAt) {
		throw new Error("OIDC client logo not found");
	}

	const object = await getOidcClientLogoObject(bucket, clientRecordId, size);
	if (!object) {
		throw new Error("OIDC client logo not found");
	}

	const headers = new Headers();
	headers.set("Content-Type", "image/webp");
	headers.set("Cache-Control", "public, max-age=31536000, immutable");
	headers.set(
		"ETag",
		`"${existing.logoUpdatedAt.toISOString()}-${size}"`,
	);

	return new Response(object.body, { headers });
}

export async function deleteOidcClientLogoFiles(
	bucket: R2Bucket,
	clientRecordId: string,
	logoUpdatedAt: Date | null,
): Promise<void> {
	if (logoUpdatedAt) {
		await deleteOidcClientLogoObjects(bucket, clientRecordId);
	}
}
