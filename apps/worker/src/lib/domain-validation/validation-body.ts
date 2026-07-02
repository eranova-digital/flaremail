import {
	VALIDATION_BODY_PREFIX,
	VALIDATION_TOKEN_HEADER,
} from "./constants";

export function buildValidationBodyText(token: string): string {
	return `${VALIDATION_BODY_PREFIX}${token}`;
}

export function extractValidationToken(
	textBody: string | null | undefined,
	headers: Headers,
): string | null {
	const headerToken = headers.get(VALIDATION_TOKEN_HEADER)?.trim();
	if (headerToken) {
		return headerToken;
	}

	if (!textBody) {
		return null;
	}

	const marker = VALIDATION_BODY_PREFIX;
	const index = textBody.indexOf(marker);
	if (index === -1) {
		return null;
	}

	const token = textBody.slice(index + marker.length).trim();
	return token || null;
}

export function dmarcRuaIncludesPostmaster(
	txtRecords: string[],
	domainName: string,
): boolean {
	const target = `mailto:postmaster@${domainName}`.toLowerCase();

	for (const record of txtRecords) {
		const normalized = record.replace(/\s+/g, "").toLowerCase();
		if (!normalized.includes("v=dmarc1")) {
			continue;
		}

		if (normalized.includes(target)) {
			return true;
		}
	}

	return false;
}
