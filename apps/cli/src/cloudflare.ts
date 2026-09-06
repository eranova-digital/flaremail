import Cloudflare from "cloudflare";

import { apiToken, type Conf } from "./config.js";
import { parsePostgresUrl } from "./secrets.js";

export type HyperdriveInfo = {
	id: string;
	name: string;
	cachingDisabled: boolean;
};

export type WorkerInfo = {
	name: string;
	workersDev: boolean | null;
	previewUrls: boolean | null;
	webOrigin: string | null;
	bindings: string[];
	serviceTargets: string[];
};

export type WorkerDomainInfo = {
	hostname: string;
	service: string;
};

export type CatchAllInfo = {
	enabled: boolean;
	worker: string | null;
};

export type DnsRecordInfo = {
	type: string;
	name: string;
	content: string;
};

export type CloudflareAdapter = {
	verifyAccount(): Promise<{ ok: boolean; error?: string }>;
	listHyperdrives(): Promise<HyperdriveInfo[]>;
	getHyperdrive(id: string): Promise<HyperdriveInfo | null>;
	createHyperdrive(conf: Conf): Promise<{ id: string }>;
	disableHyperdriveCache(id: string): Promise<void>;
	listR2Buckets(): Promise<string[]>;
	createR2Bucket(name: string): Promise<void>;
	getWorker(name: string): Promise<WorkerInfo | null>;
	listWorkerSecrets(name: string): Promise<string[]>;
	listWorkerDomains(): Promise<WorkerDomainInfo[]>;
	attachWorkerDomain(hostname: string, service: string): Promise<void>;
	getZoneId(name: string): Promise<string | null>;
	getEmailRouting(zoneId: string): Promise<{ enabled: boolean } | null>;
	enableEmailRouting(zoneId: string): Promise<void>;
	getCatchAll(zoneId: string): Promise<CatchAllInfo | null>;
	setCatchAllWorker(zoneId: string, workerName: string): Promise<void>;
	listDnsRecords(zoneId: string): Promise<DnsRecordInfo[]>;
};

export function createCloudflareAdapter(conf: Conf): CloudflareAdapter {
	const token = apiToken(conf);
	if (!token) {
		throw new Error(
			"Missing Cloudflare API token. Set cloudflare.apiToken in flaremail.conf.jsonc or CLOUDFLARE_API_TOKEN.",
		);
	}
	const client = new Cloudflare({ apiToken: token });
	const accountId = conf.cloudflare.accountId;
	return sdkAdapter(client, accountId);
}

function sdkAdapter(client: Cloudflare, accountId: string): CloudflareAdapter {
	return {
		async verifyAccount() {
			try {
				await client.accounts.get({ account_id: accountId });
				return { ok: true };
			} catch (error) {
				return { ok: false, error: errorMessage(error) };
			}
		},

		async listHyperdrives() {
			const out: HyperdriveInfo[] = [];
			for await (const item of client.hyperdrive.configs.list({
				account_id: accountId,
			})) {
				out.push(toHyperdrive(item));
			}
			return out;
		},

		async getHyperdrive(id) {
			try {
				const item = await client.hyperdrive.configs.get(id, {
					account_id: accountId,
				});
				return toHyperdrive(item);
			} catch {
				return null;
			}
		},

		async createHyperdrive(conf) {
			const origin = parsePostgresUrl(conf.database.url);
			const created = await client.hyperdrive.configs.create({
				account_id: accountId,
				name: conf.database.hyperdrive.name,
				origin: {
					scheme: origin.scheme,
					host: origin.host,
					port: origin.port,
					database: origin.database,
					user: origin.user,
					password: origin.password,
				},
				caching: { disabled: true },
			});
			const id = String(created.id ?? "");
			if (!id) throw new Error("Hyperdrive create returned no id");
			return { id };
		},

		async disableHyperdriveCache(id) {
			await client.hyperdrive.configs.edit(id, {
				account_id: accountId,
				caching: { disabled: true },
			});
		},

		async listR2Buckets() {
			const listed = await client.r2.buckets.list({ account_id: accountId });
			const buckets = (listed as { buckets?: Array<{ name?: string }> }).buckets ?? [];
			return buckets.map((bucket) => bucket.name).filter((name): name is string => Boolean(name));
		},

		async createR2Bucket(name) {
			await client.r2.buckets.create({ account_id: accountId, name });
		},

		async getWorker(name) {
			try {
				const settings = await client.workers.scripts.scriptAndVersionSettings.get(name, {
					account_id: accountId,
				});
				let workersDev: boolean | null = null;
				let previewUrls: boolean | null = null;
				try {
					const subdomain = await client.workers.scripts.subdomain.get(name, {
						account_id: accountId,
					});
					workersDev = subdomain.enabled;
					previewUrls = subdomain.previews_enabled;
				} catch {
					/* optional */
				}
				return workerFromBindings(name, settings.bindings ?? [], workersDev, previewUrls);
			} catch {
				return null;
			}
		},

		async listWorkerSecrets(name) {
			try {
				const out: string[] = [];
				for await (const secret of client.workers.scripts.secrets.list(name, {
					account_id: accountId,
				})) {
					if (secret.name) out.push(secret.name);
				}
				return out;
			} catch {
				return [];
			}
		},

		async listWorkerDomains() {
			const out: WorkerDomainInfo[] = [];
			for await (const domain of client.workers.domains.list({
				account_id: accountId,
			})) {
				if (domain.hostname && domain.service) {
					out.push({ hostname: domain.hostname, service: domain.service });
				}
			}
			return out;
		},

		async attachWorkerDomain(hostname, service) {
			const zoneId = await zoneIdForHostname(client, hostname);
			if (!zoneId) {
				throw new Error(`No Cloudflare zone found for hostname ${hostname}`);
			}
			await client.workers.domains.update({
				account_id: accountId,
				environment: "production",
				hostname,
				service,
				zone_id: zoneId,
			});
		},

		async getZoneId(name) {
			for await (const zone of client.zones.list({ name })) {
				if (zone.id) return zone.id;
			}
			return null;
		},

		async getEmailRouting(zoneId) {
			try {
				const settings = await client.emailRouting.get({ zone_id: zoneId });
				return { enabled: Boolean(settings.enabled) };
			} catch {
				return null;
			}
		},

		async enableEmailRouting(zoneId) {
			await client.emailRouting.enable({ zone_id: zoneId, body: {} });
		},

		async getCatchAll(zoneId) {
			try {
				const rule = await client.emailRouting.rules.catchAlls.get({
					zone_id: zoneId,
				});
				const actions = (rule.actions ?? []) as Array<{
					type?: string;
					value?: string[];
				}>;
				const workerAction = actions.find((action) => action.type === "worker");
				return {
					enabled: Boolean(rule.enabled),
					worker: workerAction?.value?.[0] ?? null,
				};
			} catch {
				return null;
			}
		},

		async setCatchAllWorker(zoneId, workerName) {
			await client.emailRouting.rules.catchAlls.update({
				zone_id: zoneId,
				enabled: true,
				name: "FlareMail catch-all",
				matchers: [{ type: "all" }],
				actions: [{ type: "worker", value: [workerName] }],
			});
		},

		async listDnsRecords(zoneId) {
			const out: DnsRecordInfo[] = [];
			for await (const record of client.dns.records.list({ zone_id: zoneId })) {
				out.push({
					type: String(record.type ?? ""),
					name: String(record.name ?? ""),
					content: String(record.content ?? ""),
				});
			}
			return out;
		},
	};
}

function toHyperdrive(item: { id?: string; name?: string; caching?: { disabled?: boolean } }): HyperdriveInfo {
	return {
		id: String(item.id ?? ""),
		name: String(item.name ?? ""),
		cachingDisabled: Boolean(item.caching?.disabled),
	};
}

function workerFromBindings(
	name: string,
	bindingsRaw: Array<{ type?: string; name?: string; service?: string; text?: string }>,
	workersDev: boolean | null,
	previewUrls: boolean | null,
): WorkerInfo {
	const bindings = bindingsRaw.map((binding) => binding.name || binding.type || "").filter(Boolean);
	const serviceTargets = bindingsRaw
		.filter((binding) => binding.type === "service")
		.map((binding) => String(binding.service ?? ""));
	const webOrigin =
		bindingsRaw.find((binding) => binding.type === "plain_text" && binding.name === "WEB_ORIGIN")
			?.text ?? null;
	return {
		name,
		workersDev,
		previewUrls,
		webOrigin,
		bindings,
		serviceTargets,
	};
}

async function zoneIdForHostname(client: Cloudflare, hostname: string): Promise<string | null> {
	const labels = hostname.split(".");
	while (labels.length >= 2) {
		const candidate = labels.join(".");
		for await (const zone of client.zones.list({ name: candidate })) {
			if (zone.id) return zone.id;
		}
		labels.shift();
	}
	return null;
}

function errorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}
