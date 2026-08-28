import { apiUrl } from "@/lib/api";

export type BimiLogoSize = "small" | "large";

export function bimiLogoUrl(
	domain: string,
	size: BimiLogoSize = "small",
	updatedAt?: string | null,
): string {
	const params = new URLSearchParams({ size });
	if (updatedAt) {
		params.set("v", updatedAt);
	}
	return apiUrl(`/bimi/${encodeURIComponent(domain)}/logo?${params.toString()}`);
}

export function pickBimiLogoSize(className: string): BimiLogoSize {
	return /\bsize-(1[6-9]|[2-9]\d|\d{3,})\b/.test(className) ? "large" : "small";
}
