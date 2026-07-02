export const VALIDATION_TOKEN_HEADER = "X-Flaremail-Validation-Token";

export const VALIDATION_BODY_PREFIX = "flaremail-validation-token:";

export const VALIDATION_EMAIL_SUBJECT = "Flaremail domain validation";

export const RECEIVE_TIMEOUT_MS = 10 * 60 * 1000;

export const DNS_QUERY_URL = "https://cloudflare-dns.com/dns-query";

export const CHECK_DEFINITIONS = [
	{ checkKey: "mx" as const, tier: "critical" as const },
	{ checkKey: "dmarc_rua" as const, tier: "advisory" as const },
	{ checkKey: "loop_send" as const, tier: "critical" as const },
	{ checkKey: "loop_receive" as const, tier: "critical" as const },
];
