import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse as parseJsonc, modify, applyEdits } from "jsonc-parser";
import { z } from "zod";

const jwkString = z
	.union([z.string(), z.record(z.string(), z.unknown())])
	.transform(
	(value) => (typeof value === "string" ? value : JSON.stringify(value)),
);

export const ConfSchema = z.object({
	cloudflare: z.object({
		accountId: z.string().min(1),
		apiToken: z.string().optional().default(""),
	}),
	gate: z.object({
		workerName: z.string().min(1).default("flaremail-gate"),
		hostname: z.string().min(1),
	}),
	core: z
		.object({
			workerName: z.string().min(1).default("flaremail-core"),
		})
		.default({ workerName: "flaremail-core" }),
	database: z.object({
		url: z.string(),
		hyperdrive: z.object({
			name: z.string().min(1).default("flaremail-db"),
			id: z.string().default(""),
		}),
	}),
	r2: z.object({
		bucketName: z.string().min(1).default("flaremail-bucket"),
	}),
	secrets: z.object({
		SESSION_SECRET: z.string(),
		OIDC_SIGNING_JWK: jwkString,
	}),
	mailDomains: z.array(z.string().min(1)).default([]),
	web: z
		.object({
			apiProxyTarget: z.string().optional().default(""),
		})
		.default({}),
});

export type Conf = z.infer<typeof ConfSchema>;

export function parseConf(text: string): Conf {
	const parsed = parseJsonc(text) as unknown;
	return ConfSchema.parse(parsed);
}

export function loadConfFile(path: string): Conf {
	if (!existsSync(path)) {
		throw new Error(`Missing config file: ${path}`);
	}
	return parseConf(readFileSync(path, "utf8"));
}

export function confExists(path: string): boolean {
	return existsSync(path);
}

export function gateHostname(conf: Conf): string {
	return conf.gate.hostname.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

export function productionWebOrigin(conf: Conf): string {
	return `https://${gateHostname(conf)}`;
}

export function apiProxyTarget(conf: Conf): string {
	return conf.web.apiProxyTarget.trim() || productionWebOrigin(conf);
}

export function apiToken(conf: Conf): string {
	return process.env.CLOUDFLARE_API_TOKEN?.trim() || conf.cloudflare.apiToken.trim();
}

export function formatConf(conf: Conf): string {
	const hostname = gateHostname(conf);
	const body = {
		cloudflare: {
			accountId: conf.cloudflare.accountId,
			apiToken: conf.cloudflare.apiToken,
		},
		gate: {
			workerName: conf.gate.workerName,
			hostname,
		},
		core: { workerName: conf.core.workerName },
		database: {
			url: conf.database.url,
			hyperdrive: {
				name: conf.database.hyperdrive.name,
				id: conf.database.hyperdrive.id,
			},
		},
		r2: { bucketName: conf.r2.bucketName },
		secrets: {
			SESSION_SECRET: conf.secrets.SESSION_SECRET,
			OIDC_SIGNING_JWK: tryParseJson(conf.secrets.OIDC_SIGNING_JWK),
		},
		mailDomains: conf.mailDomains,
		web: { apiProxyTarget: apiProxyTarget(conf) },
	};
	return `${CONF_HEADER}${JSON.stringify(body, null, "\t")}\n`;
}

export function saveConfFile(path: string, conf: Conf): void {
	writeFileSync(path, formatConf(conf), { encoding: "utf8", mode: 0o600 });
}

/** Patch hyperdrive id in-place so operator comments survive. */
export function writeHyperdriveId(path: string, id: string): void {
	const text = readFileSync(path, "utf8");
	const edits = modify(text, ["database", "hyperdrive", "id"], id, {
		formattingOptions: { insertSpaces: false, tabSize: 4 },
	});
	if (edits.length === 0) {
		const conf = parseConf(text);
		conf.database.hyperdrive.id = id;
		saveConfFile(path, conf);
		return;
	}
	writeFileSync(path, applyEdits(text, edits), { encoding: "utf8", mode: 0o600 });
}

function tryParseJson(value: string): unknown {
	const trimmed = value.trim();
	if (!trimmed) return "";
	try {
		return JSON.parse(trimmed) as unknown;
	} catch {
		return value;
	}
}

const CONF_HEADER = `/**
 * FlareMail instance config — source of truth for this deployment.
 * Gitignored. Do not commit. Generate or edit with \`flaremail init\`.
 */
`;
