export function normalizeEmailAddress(address: string): string {
	return address.trim().toLowerCase();
}

export function parseEmailAddress(
	address: string,
): { localPart: string; domain: string } | null {
	const normalized = normalizeEmailAddress(address);
	const atIndex = normalized.lastIndexOf("@");

	if (atIndex <= 0 || atIndex === normalized.length - 1) {
		return null;
	}

	return {
		localPart: normalized.slice(0, atIndex),
		domain: normalized.slice(atIndex + 1),
	};
}

export function buildEmailAddress(localPart: string, domain: string): string {
	return normalizeEmailAddress(`${localPart}@${domain}`);
}
