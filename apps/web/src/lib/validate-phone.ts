/**
 * Validates an optional phone number as E.164 (international format).
 * Empty values are treated as absent (valid).
 */

/** E.164: + followed by 7–15 digits, first digit non-zero. */
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export function isValidPhoneNumber(value: string): boolean {
	return E164_PATTERN.test(value.trim());
}

/**
 * Normalizes optional phone input. Empty / nullish values are absent.
 * Incomplete country-code-only values (e.g. "+1" from the phone input UI)
 * are treated as absent so optional fields don't fail saves.
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
	// Country calling code only (no subscriber digits yet).
	if (/^\+[1-9]\d{0,3}$/.test(trimmed) && !isValidPhoneNumber(trimmed)) {
		return null;
	}
	return trimmed;
}
