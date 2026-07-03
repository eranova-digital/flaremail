import { normalizeEmailAddress } from "./normalize-email-address";

export type EmailAddressInput = string | { email: string; name?: string };

export function formatEmailAddress(input: EmailAddressInput): string {
	if (typeof input === "string") {
		return input.trim();
	}

	const email = normalizeEmailAddress(input.email);
	if (!input.name?.trim()) {
		return email;
	}

	return `"${input.name.trim()}" <${email}>`;
}

export function formatEmailAddressList(inputs: EmailAddressInput[]): string {
	return inputs.map(formatEmailAddress).join(", ");
}

/**
 * Splits a formatted address-list header value (e.g. `a@x.com, "Doe, John"
 * <john@x.com>`) into individual address strings. Commas inside quoted display
 * names or angle brackets are preserved so each entry stays intact.
 */
export function splitAddressList(value: string): string[] {
	const result: string[] = [];
	let current = "";
	let inQuotes = false;
	let inAngle = false;

	for (const char of value) {
		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === "<") {
			inAngle = true;
		} else if (char === ">") {
			inAngle = false;
		} else if (char === "," && !inQuotes && !inAngle) {
			const trimmed = current.trim();
			if (trimmed) {
				result.push(trimmed);
			}
			current = "";
			continue;
		}

		current += char;
	}

	const trimmed = current.trim();
	if (trimmed) {
		result.push(trimmed);
	}

	return result;
}

export function firstEmailAddress(
	inputs: EmailAddressInput[] | string,
): string {
	if (typeof inputs === "string") {
		return normalizeEmailAddress(inputs.split(",")[0] ?? inputs);
	}

	if (!inputs.length) {
		return "";
	}

	const formatted = formatEmailAddress(inputs[0]);
	const match = formatted.match(/<([^>]+)>/);
	return normalizeEmailAddress(match?.[1] ?? formatted);
}
