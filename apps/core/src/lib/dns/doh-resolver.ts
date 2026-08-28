import { DNS_QUERY_URL } from "../domain-validation/constants";

/**
 * Cloudflare DoH resolver shaped like Node `dns.promises.resolve(name, rr)`.
 * Used by mailauth for SPF/DKIM/DMARC lookups.
 */

type DnsJsonAnswer = {
	type?: number;
	data?: string;
	name?: string;
};

type DnsJsonResponse = {
	Status?: number;
	Answer?: DnsJsonAnswer[];
};

const RR_TYPE_CODES: Record<string, number> = {
	A: 1,
	AAAA: 28,
	CNAME: 5,
	MX: 15,
	TXT: 16,
	PTR: 12,
	NS: 2,
	SOA: 6,
};

export class DnsResolveError extends Error {
	code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "DnsResolveError";
		this.code = code;
	}
}

function parseTxtChunks(data: string): string[] {
	const chunks: string[] = [];
	const re = /"((?:\\.|[^"\\])*)"|([^\s"]+)/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(data)) !== null) {
		const raw = match[1] ?? match[2] ?? "";
		chunks.push(raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
	}
	if (chunks.length === 0 && data.trim()) {
		chunks.push(data.replace(/^"|"$/g, ""));
	}
	return chunks;
}

/** Exported for unit tests — parses Cloudflare DoH TXT `data` into Node-style chunks. */
export function parseDohTxtData(data: string): string[] {
	return parseTxtChunks(data);
}

function parseMx(data: string): { priority: number; exchange: string } {
	const trimmed = data.trim().replace(/\.$/, "");
	const space = trimmed.indexOf(" ");
	if (space <= 0) {
		return { priority: 0, exchange: trimmed };
	}
	const priority = Number.parseInt(trimmed.slice(0, space), 10);
	const exchange = trimmed.slice(space + 1).trim().replace(/\.$/, "");
	return {
		priority: Number.isFinite(priority) ? priority : 0,
		exchange,
	};
}

async function queryDoh(
	name: string,
	typeCode: number,
): Promise<DnsJsonResponse> {
	const url = `${DNS_QUERY_URL}?name=${encodeURIComponent(name)}&type=${typeCode}`;
	const response = await fetch(url, {
		headers: { Accept: "application/dns-json" },
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) {
		throw new DnsResolveError(
			"ESERVFAIL",
			`DoH query failed with status ${response.status}`,
		);
	}
	return (await response.json()) as DnsJsonResponse;
}

/**
 * Resolves DNS records via Cloudflare DoH in Node `dns.promises.resolve` shapes:
 * - TXT → string[][]
 * - MX → { priority, exchange }[]
 * - A / AAAA / PTR / CNAME / NS → string[]
 */
export async function dohResolver(
	name: string,
	rr: string,
): Promise<string[][] | string[] | Array<{ priority: number; exchange: string }>> {
	const type = rr.toUpperCase();
	const typeCode = RR_TYPE_CODES[type];
	if (!typeCode) {
		throw new DnsResolveError("ENOTIMP", `Unsupported RR type ${rr}`);
	}

	const payload = await queryDoh(name, typeCode);
	// 0 = NOERROR, 3 = NXDOMAIN
	if (payload.Status === 3) {
		throw new DnsResolveError("ENOTFOUND", `queryENOTFOUND ${name}`);
	}
	if (payload.Status !== undefined && payload.Status !== 0) {
		throw new DnsResolveError(
			"ESERVFAIL",
			`DoH status ${payload.Status} for ${name}`,
		);
	}

	const answers = (payload.Answer ?? []).filter(
		(answer) => answer.type === typeCode && answer.data,
	);

	if (answers.length === 0) {
		throw new DnsResolveError("ENODATA", `queryENODATA ${name}`);
	}

	if (type === "TXT") {
		return answers.map((answer) => parseTxtChunks(answer.data!));
	}

	if (type === "MX") {
		return answers.map((answer) => parseMx(answer.data!));
	}

	return answers.map((answer) => answer.data!.trim().replace(/\.$/, ""));
}
