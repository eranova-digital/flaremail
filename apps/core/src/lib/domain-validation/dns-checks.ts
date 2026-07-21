import { DNS_QUERY_URL } from "./constants";
import { dmarcRuaIncludesPostmaster } from "./validation-body";

type DnsJsonAnswer = {
	type?: number;
	data?: string;
};

type DnsJsonResponse = {
	Answer?: DnsJsonAnswer[];
	Status?: number;
};

const TXT_TYPE = 16;
const MX_TYPE = 15;

export type DnsQueryFn = (
	name: string,
	type: "TXT" | "MX",
) => Promise<string[]>;

async function defaultDnsQuery(name: string, type: "TXT" | "MX"): Promise<string[]> {
	const recordType = type === "TXT" ? TXT_TYPE : MX_TYPE;
	const url = `${DNS_QUERY_URL}?name=${encodeURIComponent(name)}&type=${recordType}`;
	const response = await fetch(url, {
		headers: { Accept: "application/dns-json" },
	});

	if (!response.ok) {
		throw new Error(`DNS query failed with status ${response.status}`);
	}

	const payload = (await response.json()) as DnsJsonResponse;
	if (payload.Status !== 0 || !payload.Answer?.length) {
		return [];
	}

	return payload.Answer.filter((answer) => answer.type === recordType)
		.map((answer) => answer.data?.trim() ?? "")
		.filter(Boolean)
		.map((value) => value.replace(/^"|"$/g, ""));
}

export async function checkMxRecordsExist(
	domainName: string,
	query: DnsQueryFn = defaultDnsQuery,
): Promise<{ passed: boolean; code?: string; message?: string }> {
	const answers = await query(domainName, "MX");
	if (answers.length === 0) {
		return {
			passed: false,
			code: "mx_missing",
			message: "No MX records found for domain",
		};
	}

	return {
		passed: true,
		message: `Found ${answers.length} MX record(s)`,
	};
}

export async function checkDmarcRuaPostmaster(
	domainName: string,
	query: DnsQueryFn = defaultDnsQuery,
): Promise<{ passed: boolean; code?: string; message?: string }> {
	const answers = await query(`_dmarc.${domainName}`, "TXT");
	if (answers.length === 0) {
		return {
			passed: false,
			code: "dmarc_missing",
			message: "No DMARC TXT record found at _dmarc",
		};
	}

	if (!dmarcRuaIncludesPostmaster(answers, domainName)) {
		return {
			passed: false,
			code: "dmarc_rua_missing",
			message: `DMARC rua does not include mailto:postmaster@${domainName}`,
		};
	}

	return {
		passed: true,
		message: "DMARC rua includes postmaster address",
	};
}
