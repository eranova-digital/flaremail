/**
 * Validates an optional phone number as E.164 (international format).
 * Empty values are treated as absent (valid).
 */
export function normalizePhoneInput(
	value: string | null | undefined,
): string | null {
	if (value == null) {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

/** E.164: + followed by 7–15 digits, first digit non-zero. */
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export function isValidPhoneNumber(value: string): boolean {
	return E164_PATTERN.test(value.trim());
}
