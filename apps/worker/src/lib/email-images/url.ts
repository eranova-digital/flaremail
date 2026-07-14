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

	if (port && port !== "80" && port !== "443") {
		const portNumber = Number(port);
		if (!Number.isFinite(portNumber) || portNumber <= 0 || portNumber > 65535) {
			return false;
		}
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
