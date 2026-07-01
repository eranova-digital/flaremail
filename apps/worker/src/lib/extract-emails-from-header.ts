import { normalizeEmailAddress } from "./normalize-email-address";

export function extractEmailsFromHeaderValue(
	value: string | null | undefined,
): string[] {
	if (!value?.trim()) {
		return [];
	}

	const emails = new Set<string>();

	for (const match of value.matchAll(/<([^>]+)>/g)) {
		const normalized = normalizeEmailAddress(match[1]);
		if (normalized.includes("@")) {
			emails.add(normalized);
		}
	}

	for (const part of value.split(",")) {
		const trimmed = part.trim();
		if (!trimmed || trimmed.includes("<")) {
			continue;
		}

		const normalized = normalizeEmailAddress(trimmed);
		if (normalized.includes("@")) {
			emails.add(normalized);
		}
	}

	return [...emails];
}
