import decodeJpeg from "@jsquash/jpeg/decode";
import decodePng from "@jsquash/png/decode";
import decodeWebp from "@jsquash/webp/decode";
import encodeWebp from "@jsquash/webp/encode";
import resize from "@jsquash/resize";

import { centerSquareCrop } from "./center-square-crop";
import { ensureJsquashInitialized } from "./init-jsquash";
import {
	PROFILE_PICTURE_LARGE_SIZE,
	PROFILE_PICTURE_SMALL_SIZE,
} from "./keys";

export const PROFILE_PICTURE_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
]);

export type ProcessedProfilePicture = {
	small: Uint8Array;
	large: Uint8Array;
};

export function isAllowedProfilePictureMimeType(mimeType: string): boolean {
	return ALLOWED_MIME_TYPES.has(mimeType);
}

async function decodeProfilePicture(
	bytes: ArrayBuffer,
	mimeType: string,
): Promise<ImageData> {
	switch (mimeType) {
		case "image/jpeg":
			return decodeJpeg(bytes);
		case "image/png":
			return decodePng(bytes);
		case "image/webp":
			return decodeWebp(bytes);
		default:
			throw new Error("Unsupported image type");
	}
}

async function encodeSquareWebp(
	data: ImageData,
	size: number,
): Promise<Uint8Array> {
	const resized = await resize(data, {
		width: size,
		height: size,
		method: "lanczos3",
		fitMethod: "stretch",
	});
	const encoded = await encodeWebp(resized, { quality: 85 });
	return new Uint8Array(encoded);
}

export async function processProfilePicture(
	bytes: ArrayBuffer,
	mimeType: string,
): Promise<ProcessedProfilePicture> {
	await ensureJsquashInitialized();

	if (bytes.byteLength > PROFILE_PICTURE_MAX_BYTES) {
		throw new Error("Image is too large");
	}
	if (!isAllowedProfilePictureMimeType(mimeType)) {
		throw new Error("Unsupported image type");
	}

	const decoded = await decodeProfilePicture(bytes, mimeType);
	const cropped = centerSquareCrop(decoded);

	const [small, large] = await Promise.all([
		encodeSquareWebp(cropped, PROFILE_PICTURE_SMALL_SIZE),
		encodeSquareWebp(cropped, PROFILE_PICTURE_LARGE_SIZE),
	]);

	return { small, large };
}
