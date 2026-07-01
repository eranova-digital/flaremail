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
