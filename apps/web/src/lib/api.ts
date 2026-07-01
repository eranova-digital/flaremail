function normalizeApiUrl(raw: string): string {
	const trimmed = raw.trim().replace(/\/+$/, "");
	if (!trimmed) {
		return "";
	}

	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed;
	}

	return `https://${trimmed}`;
}

/** Worker base URL from `API_URL` in `apps/web/.env`. */
export function getApiUrl(): string {
	const url = import.meta.env.API_URL;
	if (!url?.trim()) {
		throw new Error("API_URL is not set. Add it to apps/web/.env");
	}

	return normalizeApiUrl(url);
}

/** Build a full URL for a Worker API path. */
export function apiUrl(path: string): string {
	const base = getApiUrl();
	const suffix = path.startsWith("/") ? path : `/${path}`;
	return `${base}${suffix}`;
}
