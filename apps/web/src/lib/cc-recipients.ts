import { parseEmailAddressDisplay } from "@/lib/format-email-address";

function splitAddressList(value: string): string[] {
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

function normalizeCcEmail(address: string): string {
	return parseEmailAddressDisplay(address).email.trim().toLowerCase();
}

export function parseAddresses(value?: string | null): string[] {
	if (!value?.trim()) {
		return [];
	}

	const addresses: string[] = [];
	for (const entry of splitAddressList(value)) {
		const normalized = normalizeCcEmail(entry);
		if (normalized) {
			addresses.push(normalized);
		}
	}

	return addresses;
}

/**
 * Returns the cc recipients on the current message that have never appeared
 * anywhere (from/to/cc) in earlier messages of the thread. This intentionally
 * ignores addresses that reappear in cc purely as a side effect of "Reply All"
 * carrying existing participants forward.
 */
export function getNewCcRecipients(
	seenAddresses: Set<string>,
	currentCc?: string | null,
): string[] {
	if (!currentCc?.trim()) {
		return [];
	}

	const added: string[] = [];
	const alreadyAdded = new Set<string>();
	for (const entry of splitAddressList(currentCc)) {
		const normalized = normalizeCcEmail(entry);
		if (!normalized || seenAddresses.has(normalized) || alreadyAdded.has(normalized)) {
			continue;
		}

		added.push(normalized);
		alreadyAdded.add(normalized);
	}

	return added;
}

export function formatAddedCcRecipients(recipients: string[]): string {
	return recipients.join(", ");
}

function formatAddressField(
	label: "To" | "CC" | "BCC",
	value?: string | null,
	selfAddress?: string | null,
): string | null {
	const self = selfAddress?.trim().toLowerCase() ?? "";
	const seen = new Set<string>();
	const labels: string[] = [];
	let hasMe = false;

	for (const address of parseAddresses(value)) {
		if (self && address === self) {
			hasMe = true;
			continue;
		}
		if (seen.has(address)) {
			continue;
		}
		seen.add(address);
		labels.push(address);
	}

	const parts = hasMe ? ["me", ...labels] : labels;
	if (parts.length === 0) {
		return null;
	}

	return `${label}: ${parts.join(", ")}`;
}

/**
 * Builds a compact recipient line with To, CC, and BCC distinguished.
 */
export function formatRecipientList(
	to?: string | null,
	cc?: string | null,
	bcc?: string | null,
	selfAddress?: string | null,
): string {
	return [
		formatAddressField("To", to, selfAddress),
		formatAddressField("CC", cc, selfAddress),
		formatAddressField("BCC", bcc, selfAddress),
	]
		.filter((segment): segment is string => segment !== null)
		.join(", ");
}
