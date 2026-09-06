import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CloudflareAdapter } from "./cloudflare.js";
import { type Conf, gateHostname, writeHyperdriveId } from "./config.js";
import { evaluateHealth, type HealthCheck, type HealthReport, collectSnapshot } from "./health.js";
import { materialize } from "./materialize.js";
import type { RepoPaths } from "./paths.js";
import { REQUIRED_SECRETS } from "./templates.js";
import { runOrThrow } from "./spawn.js";

export type LogFn = (line: string) => void;

export type ApplyResult = {
	report: HealthReport;
	changed: string[];
};

export async function applyInfrastructure(
	conf: Conf,
	paths: RepoPaths,
	cf: CloudflareAdapter,
	log: LogFn,
): Promise<ApplyResult> {
	const changed: string[] = [];
	let working = { ...conf };

	const first = evaluateHealth(working, await collectSnapshot(working, cf));
	for (const check of first.checks.filter((item) => item.repairable && item.status !== "ok")) {
		const next = await repair(check, working, paths, cf, log);
		if (next) {
			working = next.conf;
			changed.push(check.id);
		}
	}

	if (working.database.hyperdrive.id !== conf.database.hyperdrive.id) {
		writeHyperdriveId(paths.conf, working.database.hyperdrive.id);
		materialize(working, paths);
		log(`wrote Hyperdrive id ${working.database.hyperdrive.id} to conf`);
	}

	const report = evaluateHealth(working, await collectSnapshot(working, cf));
	return { report, changed };
}

async function repair(
	check: HealthCheck,
	conf: Conf,
	paths: RepoPaths,
	cf: CloudflareAdapter,
	log: LogFn,
): Promise<{ conf: Conf } | null> {
	if (check.id === "hyperdrive") {
		return { conf: await repairHyperdrive(conf, cf, log) };
	}
	if (check.id === "r2") {
		log(`creating R2 bucket ${conf.r2.bucketName}`);
		await cf.createR2Bucket(conf.r2.bucketName);
		return { conf };
	}
	if (check.id === "secrets") {
		await putCoreSecrets(conf, paths, log);
		return { conf };
	}
	if (check.id === "gate-hostname") {
		const hostname = gateHostname(conf);
		log(`attaching custom domain ${hostname} → ${conf.gate.workerName}`);
		await cf.attachWorkerDomain(hostname, conf.gate.workerName);
		return { conf };
	}
	if (check.id.startsWith("email-routing:")) {
		const domain = check.id.slice("email-routing:".length);
		const zoneId = await cf.getZoneId(domain);
		if (!zoneId) return null;
		log(`enabling Email Routing on ${domain}`);
		await cf.enableEmailRouting(zoneId);
		return { conf };
	}
	if (check.id.startsWith("catch-all:")) {
		const domain = check.id.slice("catch-all:".length);
		const zoneId = await cf.getZoneId(domain);
		if (!zoneId) return null;
		log(`setting catch-all on ${domain} → ${conf.core.workerName}`);
		await cf.setCatchAllWorker(zoneId, conf.core.workerName);
		return { conf };
	}
	return null;
}

async function repairHyperdrive(
	conf: Conf,
	cf: CloudflareAdapter,
	log: LogFn,
): Promise<Conf> {
	const id = conf.database.hyperdrive.id.trim();
	const listed = await cf.listHyperdrives();
	const existing =
		(id ? listed.find((item) => item.id === id) : undefined) ??
		listed.find((item) => item.name === conf.database.hyperdrive.name);

	if (existing) {
		if (!existing.cachingDisabled) {
			log(`disabling Hyperdrive cache on ${existing.id}`);
			await cf.disableHyperdriveCache(existing.id);
		}
		return {
			...conf,
			database: {
				...conf.database,
				hyperdrive: { ...conf.database.hyperdrive, id: existing.id },
			},
		};
	}

	log(`creating Hyperdrive ${conf.database.hyperdrive.name}`);
	const created = await cf.createHyperdrive(conf);
	return {
		...conf,
		database: {
			...conf.database,
			hyperdrive: { ...conf.database.hyperdrive, id: created.id },
		},
	};
}

export async function putCoreSecrets(
	conf: Conf,
	paths: RepoPaths,
	log: LogFn,
): Promise<void> {
	const secrets: Record<string, string> = {};
	for (const key of REQUIRED_SECRETS) {
		const value = conf.secrets[key]?.trim();
		if (!value) {
			throw new Error(`Missing secret ${key} in flaremail.conf.jsonc`);
		}
		secrets[key] = value;
	}
	const dir = mkdtempSync(join(tmpdir(), "flaremail-secrets-"));
	const file = join(dir, "secrets.json");
	writeFileSync(file, `${JSON.stringify(secrets, null, 2)}\n`, { mode: 0o600 });
	try {
		log("uploading core Worker secrets");
		await runOrThrow("wrangler", ["secret", "bulk", file], {
			cwd: paths.core,
			env: wranglerEnv(conf),
		});
	} finally {
		try {
			unlinkSync(file);
		} catch {
			/* ignore */
		}
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
	}
}

export function wranglerEnv(conf: Conf): NodeJS.ProcessEnv {
	const token = process.env.CLOUDFLARE_API_TOKEN?.trim() || conf.cloudflare.apiToken.trim();
	const env: NodeJS.ProcessEnv = {};
	if (token) env.CLOUDFLARE_API_TOKEN = token;
	if (conf.cloudflare.accountId) {
		env.CLOUDFLARE_ACCOUNT_ID = conf.cloudflare.accountId;
	}
	return env;
}
