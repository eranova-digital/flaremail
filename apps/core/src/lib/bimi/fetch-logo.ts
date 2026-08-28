import {
	assertHostnameResolvesPublicly,
	isAllowedRemoteImageUrl,
	normalizeImageUrl,
	RemoteImageFetchError,
} from "../email-images/cache-image";
import {
	BIMI_FETCH_MAX_REDIRECTS,
	BIMI_FETCH_TIMEOUT_MS,
	BIMI_SVG_MAX_BYTES,
} from "./constants";

const ALLOWED_SVG_MIME_TYPES = new Set([
	"image/svg+xml",
	"text/xml",
	"application/xml",
	"application/svg+xml",
]);

function isSvgContentType(contentType: string | null): boolean {
	if (!contentType) {
		return false;
	}
	const mimeType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
	return ALLOWED_SVG_MIME_TYPES.has(mimeType);
}

function isHttpsUrl(rawUrl: string): boolean {
	try {
		return new URL(rawUrl).protocol === "https:";
	} catch {
		return false;
	}
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
		if (totalBytes > BIMI_SVG_MAX_BYTES) {
			throw new RemoteImageFetchError("BIMI SVG exceeds size limit");
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

/**
 * Fetch a BIMI SVG over HTTPS with the same SSRF guards as remote email images.
 */
export async function fetchBimiSvg(rawUrl: string): Promise<string> {
	const normalized = normalizeImageUrl(rawUrl);
	if (
		!normalized ||
		!isHttpsUrl(normalized) ||
		!isAllowedRemoteImageUrl(normalized)
	) {
		throw new RemoteImageFetchError("BIMI logo URL is not allowed");
	}

	let currentUrl = normalized;

	for (
		let redirectCount = 0;
		redirectCount <= BIMI_FETCH_MAX_REDIRECTS;
		redirectCount++
	) {
		if (!isHttpsUrl(currentUrl) || !isAllowedRemoteImageUrl(currentUrl)) {
			throw new RemoteImageFetchError("BIMI redirect target is not allowed");
		}

		const { hostname } = new URL(currentUrl);
		await assertHostnameResolvesPublicly(hostname);

		const response = await fetch(currentUrl, {
			method: "GET",
			redirect: "manual",
			signal: AbortSignal.timeout(BIMI_FETCH_TIMEOUT_MS),
			headers: {
				Accept: "image/svg+xml,application/xml;q=0.9,*/*;q=0.1",
				"User-Agent": "Flaremail/1.0 BIMI",
			},
		});

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get("Location");
			if (!location) {
				throw new RemoteImageFetchError(
					"BIMI redirect response missing Location header",
				);
			}
			currentUrl = new URL(location, currentUrl).toString();
			continue;
		}

		if (!response.ok) {
			throw new RemoteImageFetchError(
				`BIMI SVG fetch failed with status ${response.status}`,
			);
		}

		const contentType = response.headers.get("Content-Type");
		const body = await readResponseBytes(response);
		if (body.byteLength === 0) {
			throw new RemoteImageFetchError("BIMI SVG is empty");
		}

		const text = new TextDecoder("utf-8").decode(body);
		const looksLikeSvg = /<svg[\s>]/i.test(text);
		if (!isSvgContentType(contentType) && !looksLikeSvg) {
			throw new RemoteImageFetchError("BIMI response is not an SVG");
		}
		if (!looksLikeSvg) {
			throw new RemoteImageFetchError("BIMI response is not an SVG");
		}

		return text;
	}

	throw new RemoteImageFetchError("BIMI SVG fetch exceeded redirect limit");
}
