import { existsSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { applyInfrastructure, wranglerEnv, type LogFn } from "./apply.js";
import { createCloudflareAdapter } from "./cloudflare.js";
import type { Conf } from "./config.js";
import { materialize } from "./materialize.js";
import type { RepoPaths } from "./paths.js";
import { REQUIRED_SECRETS } from "./templates.js";
import { runOrThrow } from "./spawn.js";

export type DeployTarget = "all" | "core" | "gate";

export async function deploy(options: {
	conf: Conf;
	paths: RepoPaths;
	target: DeployTarget;
	log: LogFn;
}): Promise<void> {
	const { conf, paths, target, log } = options;
	materialize(conf, paths);
	log("materialized .env and wrangler.jsonc");

	if (target === "all" || target === "core") {
		const cf = createCloudflareAdapter(conf);
		const applied = await applyInfrastructure(conf, paths, cf, log);
		if (applied.changed.length > 0) {
			log(`apply: ${applied.changed.join(", ")}`);
		}
		log("migrating database");
		await runOrThrow("npm", ["run", "db:migrate"], { cwd: paths.core });
		log("deploying core");
		await deployCore(conf, paths);
	}

	if (target === "all" || target === "gate") {
		log("building web");
		await runOrThrow("npm", ["run", "build"], { cwd: paths.web });
		if (!existsSync(join(paths.web, "dist"))) {
			throw new Error("apps/web/dist missing after build");
		}
		log("deploying gate");
		await runOrThrow("wrangler", ["deploy"], {
			cwd: paths.gate,
			env: wranglerEnv(conf),
		});
	}
}

async function deployCore(conf: Conf, paths: RepoPaths): Promise<void> {
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
		await runOrThrow("wrangler", ["deploy", "--secrets-file", file], {
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

export async function startDev(conf: Conf, paths: RepoPaths, log: LogFn): Promise<void> {
	materialize(conf, paths);
	log("materialized .env and wrangler.jsonc");
	log("starting core + gate");
	await runOrThrow(
		"npx",
		[
			"concurrently",
			"-n",
			"core,gate",
			"-c",
			"blue,magenta",
			"npm run dev -w @flaremail/core",
			"npm run dev -w @flaremail/gate",
		],
		{ cwd: paths.root, env: wranglerEnv(conf) },
	);
}
