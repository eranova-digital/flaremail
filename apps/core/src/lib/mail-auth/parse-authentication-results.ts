import type { DmarcResult } from "../../db/schema";
import { computeBimiEligibility } from "./eligibility";

const TRUSTED_AUTHSERV_PATTERN = /(?:^|;)\s*mx\.cloudflare\.net\b/i;

function normalizeDmarcResult(raw: string): DmarcResult {
	switch (raw.toLowerCase()) {
		case "pass":
			return "pass";
		case "fail":
			return "fail";
		case "none":
			return "none";
		case "temperror":
		case "temperr":
			return "temperror";
		case "permerror":
			return "permerror";
		default:
			return "none";
	}
}

/**
 * Extract SMTP client IP stamped by Cloudflare Email Routing auth headers.
 */
export function extractClientIpFromAuthHeaders(
	authenticationResults: string | null | undefined,
	receivedSpf: string | null | undefined,
): string | undefined {
	const sources = [authenticationResults, receivedSpf].filter(Boolean) as string[];
	for (const source of sources) {
		const remoteIp = source.match(/smtp\.remote-ip=([^\s;]+)/i)?.[1];
		if (remoteIp) {
			return remoteIp.replace(/^\[|\]$/g, "");
		}
		const clientIp = source.match(/client-ip=([^\s;]+)/i)?.[1];
		if (clientIp) {
			return clientIp.replace(/^\[|\]$/g, "");
		}
	}
	return undefined;
}

/**
 * Parse DMARC outcome from a trusted Cloudflare Authentication-Results header.
 * Used when mailauth re-verification cannot reproduce the edge verdict (missing IP, etc.).
 */
export function parseTrustedDmarcFromAuthResults(
	value: string | null | undefined,
): {
	dmarcResult: DmarcResult;
	alignedDomain: string | null;
	policy: string | null;
	eligibleForBimi: boolean;
} | null {
	if (!value?.trim() || !TRUSTED_AUTHSERV_PATTERN.test(value)) {
		return null;
	}

	const dmarcRaw = value.match(/(?:^|;)\s*dmarc=(\w+)/i)?.[1];
	if (!dmarcRaw) {
		return null;
	}

	const dmarcResult = normalizeDmarcResult(dmarcRaw);
	const fromRaw = value.match(/header\.from=([^\s;]+)/i)?.[1];
	const alignedDomain = fromRaw?.toLowerCase().replace(/\.$/, "").trim() || null;
	const policyRaw =
		value.match(/policy\.dmarc=([^\s;]+)/i)?.[1] ??
		value.match(/(?:^|;)\s*p=([^\s;]+)/i)?.[1];
	const policy = policyRaw?.toLowerCase().trim() ?? null;

	const eligibleForBimi = computeBimiEligibility({
		dmarcResult,
		policy,
		alignedDomain,
	});

	return {
		dmarcResult,
		alignedDomain,
		policy,
		eligibleForBimi,
	};
}

export function parseTrustedDmarcFromHeaders(
	authenticationResults: string | null | undefined,
	arcAuthenticationResults: string | null | undefined,
): ReturnType<typeof parseTrustedDmarcFromAuthResults> {
	return (
		parseTrustedDmarcFromAuthResults(authenticationResults) ??
		parseTrustedDmarcFromAuthResults(arcAuthenticationResults)
	);
}
