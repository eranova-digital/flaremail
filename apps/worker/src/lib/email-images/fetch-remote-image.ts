import {
	MAX_REMOTE_IMAGE_BYTES,
	REMOTE_IMAGE_FETCH_TIMEOUT_MS,
	REMOTE_IMAGE_MAX_REDIRECTS,
} from "./constants";
import { isAllowedRemoteImageUrl, normalizeImageUrl } from "./url";

export class RemoteImageFetchError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RemoteImageFetchError";
	}
}

function isImageContentType(contentType: string | null): boolean {
	if (!contentType) {
		return false;
	}

	const mimeType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
	return mimeType.startsWith("image/");
}

async function readResponseBytes(response: Response): Promise<ArrayBuffer> {
	const reader = response.body?.getReader();
	if (!reader) {
		return new ArrayBuffer(0);
	}

	const chunks: Uint8Array[] = [];
	let totalBytes = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		if (!value) {
			continue;
		}

		totalBytes += value.byteLength;
		if (totalBytes > MAX_REMOTE_IMAGE_BYTES) {
			throw new RemoteImageFetchError("Remote image exceeds size limit");
		}

		chunks.push(value);
	}

	const merged = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		merged.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return merged.buffer;
}

export async function fetchRemoteImage(
	rawUrl: string,
): Promise<{ body: ArrayBuffer; mimeType: string }> {
	const normalized = normalizeImageUrl(rawUrl);
	if (!normalized || !isAllowedRemoteImageUrl(normalized)) {
		throw new RemoteImageFetchError("Remote image URL is not allowed");
	}

	let currentUrl = normalized;

	for (let redirectCount = 0; redirectCount <= REMOTE_IMAGE_MAX_REDIRECTS; redirectCount++) {
		if (!isAllowedRemoteImageUrl(currentUrl)) {
			throw new RemoteImageFetchError("Redirect target is not allowed");
		}

		const response = await fetch(currentUrl, {
			method: "GET",
			redirect: "manual",
			signal: AbortSignal.timeout(REMOTE_IMAGE_FETCH_TIMEOUT_MS),
			headers: {
				Accept: "image/*",
				"User-Agent": "Flaremail/1.0 ImageProxy",
			},
		});

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get("Location");
			if (!location) {
				throw new RemoteImageFetchError("Redirect response missing Location header");
			}
			currentUrl = new URL(location, currentUrl).toString();
			continue;
		}

		if (!response.ok) {
			throw new RemoteImageFetchError(
				`Remote image fetch failed with status ${response.status}`,
			);
		}

		const contentType = response.headers.get("Content-Type");
		if (!isImageContentType(contentType)) {
			throw new RemoteImageFetchError("Remote response is not an image");
		}

		const body = await readResponseBytes(response);
		if (body.byteLength === 0) {
			throw new RemoteImageFetchError("Remote image is empty");
		}

		return {
			body,
			mimeType: contentType!.split(";")[0]!.trim().toLowerCase(),
		};
	}

	throw new RemoteImageFetchError("Too many redirects while fetching image");
}
