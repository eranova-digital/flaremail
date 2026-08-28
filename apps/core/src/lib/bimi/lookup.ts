import { getDomain } from "tldts";

import { BIMI_SELECTOR } from "./constants";
import { dohResolver } from "../dns/doh-resolver";

const TLDTS_OPTS = {
	allowIcannDomains: true,
	allowPrivateDomains: true,
} as const;

export type BimiTxtRecord = {
	version: string;
	location: string;
	authority: string | null;
};

/**
 * Domains to try for BIMI TXT: aligned From domain first, then org domain.
 */
export function bimiCandidateDomains(alignedDomain: string): string[] {
	const normalized = alignedDomain.toLowerCase().trim().replace(/\.$/, "");
	if (!normalized) {
		return [];
	}

	const candidates = [normalized];
	const org = getDomain(normalized, TLDTS_OPTS);
	if (org && org.toLowerCase() !== normalized) {
		candidates.push(org.toLowerCase());
	}
	return candidates;
}

export function bimiTxtName(domain: string, selector = BIMI_SELECTOR): string {
	return `${selector}._bimi.${domain.toLowerCase()}`;
}

/**
 * Parse a BIMI1 TXT record. Self-asserted (no `a=`) is accepted.
 */
export function parseBimiTxt(raw: string): BimiTxtRecord | null {
	const cleaned = raw.replace(/\s+/g, " ").trim();
	if (!cleaned) {
		return null;
	}

	const tags = new Map<string, string>();
	for (const part of cleaned.split(";")) {
		const trimmed = part.trim();
		if (!trimmed) {
			continue;
		}
		const eq = trimmed.indexOf("=");
		if (eq <= 0) {
			continue;
		}
		const key = trimmed.slice(0, eq).trim().toLowerCase();
		const value = trimmed.slice(eq + 1).trim();
		if (key) {
			tags.set(key, value);
		}
	}

	const version = tags.get("v");
	if (!version || version.toUpperCase() !== "BIMI1") {
		return null;
	}

	const location = tags.get("l")?.trim() ?? "";
	if (!location || !/^https:\/\//i.test(location)) {
		return null;
	}

	const authority = tags.get("a")?.trim() || null;
	return {
		version: "BIMI1",
		location,
		authority: authority && authority !== "" ? authority : null,
	};
}

export type BimiLookupResult = {
	domain: string;
	record: BimiTxtRecord;
};

/**
 * Lookup BIMI TXT for a single publishing domain (no PSL walk).
 */
export async function lookupBimiRecordForDomain(
	domain: string,
	resolver: typeof dohResolver = dohResolver,
): Promise<BimiLookupResult | null> {
	const normalized = domain.toLowerCase().trim().replace(/\.$/, "");
	if (!normalized) {
		return null;
	}

	const name = bimiTxtName(normalized);
	let rows: string[][];
	try {
		const answers = await resolver(name, "TXT");
		rows = answers as string[][];
	} catch (error) {
		const code =
			error instanceof Error && "code" in error
				? String((error as { code?: string }).code)
				: "";
		if (code === "ENOTFOUND" || code === "ENODATA") {
			return null;
		}
		return null;
	}

	for (const row of rows) {
		const joined = ([] as string[]).concat(row).join("").trim();
		const parsed = parseBimiTxt(joined);
		if (parsed) {
			return { domain: normalized, record: parsed };
		}
	}

	return null;
}

/**
 * Walk candidate domains and return the first valid BIMI TXT assertion.
 */
export async function lookupBimiRecord(
	alignedDomain: string,
	resolver: typeof dohResolver = dohResolver,
): Promise<BimiLookupResult | null> {
	for (const domain of bimiCandidateDomains(alignedDomain)) {
		const found = await lookupBimiRecordForDomain(domain, resolver);
		if (found) {
			return found;
		}
	}

	return null;
}
