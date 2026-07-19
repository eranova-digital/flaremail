import type { NewMessageExternalImage } from "../../db/schema";

export const MAX_REMOTE_IMAGE_BYTES = 10 * 1024 * 1024;
export const REMOTE_IMAGE_FETCH_TIMEOUT_MS = 10_000;
export const REMOTE_IMAGE_MAX_REDIRECTS = 3;

export const IMAGE_CACHE_KEY_PREFIX = "images/cache";

const BLOCKED_HOSTNAMES = new Set([
	"localhost",
	"localhost.localdomain",
	"metadata.google.internal",
	"metadata.goog",
]);

const PRIVATE_IPV4_RANGES = [
	/^127\./,
	/^10\./,
	/^192\.168\./,
	/^169\.254\./,
	/^0\./,
	/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
	/^172\.(1[6-9]|2\d|3[01])\./,
];

function isPrivateIpv4(hostname: string): boolean {
	return PRIVATE_IPV4_RANGES.some((pattern) => pattern.test(hostname));
}

function isPrivateIpv6(hostname: string): boolean {
	const normalized = hostname.toLowerCase();
	return (
		normalized === "::1" ||
		normalized.startsWith("fc") ||
		normalized.startsWith("fd") ||
		normalized.startsWith("fe80:")
	);
}

function isBlockedResolvedAddress(address: string): boolean {
	const lower = address.toLowerCase().replace(/^\[|\]$/g, "");
	if (isPrivateIpv4(lower) || isPrivateIpv6(lower)) {
		return true;
	}
	const v4Mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
	if (v4Mapped && isPrivateIpv4(v4Mapped[1])) {
		return true;
	}
	return false;
}

/**
 * Resolve hostname via Cloudflare DNS-over-HTTPS and reject private answers
 * to reduce DNS-rebinding risk before fetching remote images.
 */
export async function assertHostnameResolvesPublicly(
	hostname: string,
): Promise<void> {
	const lower = hostname.toLowerCase();
	if (isBlockedResolvedAddress(lower)) {
		throw new RemoteImageFetchError("Remote image host is not allowed");
	}
	// Literal IPs already validated by isAllowedRemoteImageUrl.
	if (/^\d+\.\d+\.\d+\.\d+$/.test(lower) || lower.includes(":")) {
		return;
	}

	const types = ["A", "AAAA"] as const;
	let sawAnswer = false;
	for (const type of types) {
		const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(lower)}&type=${type}`;
		const response = await fetch(url, {
			headers: { Accept: "application/dns-json" },
			signal: AbortSignal.timeout(REMOTE_IMAGE_FETCH_TIMEOUT_MS),
		});
		if (!response.ok) {
			continue;
		}
		const data = (await response.json()) as {
			Answer?: Array<{ data?: string }>;
		};
		for (const answer of data.Answer ?? []) {
			const address = answer.data?.trim();
			if (!address) {
				continue;
			}
			sawAnswer = true;
			if (isBlockedResolvedAddress(address)) {
				throw new RemoteImageFetchError("Remote image host resolves privately");
			}
		}
	}

	if (!sawAnswer) {
		throw new RemoteImageFetchError("Remote image host could not be resolved");
	}
}

export function normalizeImageUrl(rawUrl: string): string | null {
	const trimmed = rawUrl.trim();
	if (!trimmed) {
		return null;
	}

	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null;
		}
		if (parsed.username || parsed.password) {
			return null;
		}
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return null;
	}
}

export function isExternalImageUrl(rawUrl: string): boolean {
	const normalized = normalizeImageUrl(rawUrl);
	return normalized !== null;
}

export function isAllowedRemoteImageUrl(rawUrl: string): boolean {
	const normalized = normalizeImageUrl(rawUrl);
	if (!normalized) {
		return false;
	}

	const { hostname, port } = new URL(normalized);
	const lowerHost = hostname.toLowerCase();

	if (BLOCKED_HOSTNAMES.has(lowerHost)) {
		return false;
	}

	if (lowerHost.endsWith(".localhost") || lowerHost.endsWith(".local")) {
		return false;
	}

	if (isPrivateIpv4(lowerHost) || isPrivateIpv6(lowerHost)) {
		return false;
	}

	// IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
	const v4Mapped = lowerHost.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
	if (v4Mapped && isPrivateIpv4(v4Mapped[1])) {
		return false;
	}

	if (port && port !== "80" && port !== "443") {
		return false;
	}

	return true;
}

export function parseSrcsetUrls(srcset: string): string[] {
	return srcset
		.split(",")
		.map((entry) => entry.trim().split(/\s+/)[0] ?? "")
		.filter(Boolean);
}

export function rewriteSrcset(
	srcset: string,
	replaceUrl: (url: string) => string | null,
): string | null {
	let changed = false;
	const rewritten = srcset
		.split(",")
		.map((entry) => {
			const trimmed = entry.trim();
			if (!trimmed) {
				return trimmed;
			}

			const [url, ...descriptorParts] = trimmed.split(/\s+/);
			if (!url) {
				return trimmed;
			}

			const nextUrl = replaceUrl(url);
			if (!nextUrl || nextUrl === url) {
				return trimmed;
			}

			changed = true;
			return [nextUrl, ...descriptorParts].join(" ");
		})
		.join(", ");

	return changed ? rewritten : null;
}

export async function hashImageUrl(rawUrl: string): Promise<string | null> {
	const normalized = normalizeImageUrl(rawUrl);
	if (!normalized) {
		return null;
	}

	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(normalized),
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export async function imageCacheKeyForUrl(rawUrl: string): Promise<string | null> {
	const hash = await hashImageUrl(rawUrl);
	if (!hash) {
		return null;
	}

	return `${IMAGE_CACHE_KEY_PREFIX}/${hash}`;
}

export class RemoteImageFetchError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RemoteImageFetchError";
	}
}

const ALLOWED_IMAGE_MIME_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/jpg",
	"image/gif",
	"image/webp",
	"image/avif",
]);

function isImageContentType(contentType: string | null): boolean {
	if (!contentType) {
		return false;
	}

	const mimeType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
	return ALLOWED_IMAGE_MIME_TYPES.has(mimeType);
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

		const { hostname } = new URL(currentUrl);
		await assertHostnameResolvesPublicly(hostname);

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
