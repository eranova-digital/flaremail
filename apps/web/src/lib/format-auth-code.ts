/**
 * Normalizes invite / reset codes to the canonical XXXX-XXXX shape as the
 * user types or pastes: uppercases, strips separators, re-inserts the dash.
 */
export function formatAuthCode(raw: string): string {
	const cleaned = raw
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "")
		.slice(0, 8);
	if (cleaned.length <= 4) {
		return cleaned;
	}
	return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
}
