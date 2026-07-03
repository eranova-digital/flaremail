export type ParsedEmailAddress = {
	display: string;
	email: string;
	hasDisplayName: boolean;
};

export function parseEmailAddressDisplay(
	value?: string | null,
): ParsedEmailAddress {
	const trimmed = value?.trim() ?? "";
	if (!trimmed) {
		return {
			display: "(unknown)",
			email: "",
			hasDisplayName: false,
		};
	}

	const envelopeMatch = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
	if (envelopeMatch) {
		const name = envelopeMatch[1]
			.trim()
			.replace(/^["']|["']$/g, "");
		const email = envelopeMatch[2].trim();

		return {
			display: name,
			email,
			hasDisplayName: true,
		};
	}

	return {
		display: trimmed,
		email: trimmed,
		hasDisplayName: false,
	};
}
