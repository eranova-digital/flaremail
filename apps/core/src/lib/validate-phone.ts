/**
 * Validates an optional phone number as E.164 (international format).
 * Empty / nullish values are treated as absent (valid).
 */

/** E.164: + followed by 7–15 digits, first digit non-zero. */
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export function isValidPhoneNumber(value: string): boolean {
	return E164_PATTERN.test(value.trim());
}

/**
 * Normalizes optional phone input. Empty / nullish values are absent.
 * Incomplete country-code-only values (e.g. "+1" from phone UIs) are treated
 * as absent so optional phone fields don't reject otherwise-valid requests.
 */
export function normalizePhoneInput(
	value: string | null | undefined,
): string | null {
	if (value == null) {
		return null;
	}
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return null;
	}
	if (/^\+[1-9]\d{0,3}$/.test(trimmed) && !isValidPhoneNumber(trimmed)) {
		return null;
	}
	return trimmed;
}

export function assertValidPhoneNumber(
	value: string | null | undefined,
): string | null {
	const normalized = normalizePhoneInput(value);
	if (normalized === null) {
		return null;
	}
	if (!isValidPhoneNumber(normalized)) {
		throw new Error(
			"Phone number must be a valid international number in E.164 format (e.g. +14155552671)",
		);
	}
	return normalized;
}
