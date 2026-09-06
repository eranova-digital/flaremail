import { Command } from "commander";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { gateHostname, type Conf } from "./config.js";
import type { DeployTarget } from "./deploy.js";
import type { ActualSnapshot } from "./health.js";
import { repoPaths } from "./paths.js";
import { sync } from "./sync.js";

function version(root: string): string {
	try {
		const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
			version?: string;
		};
		return pkg.version ?? "0.0.0";
	} catch {
		return "0.0.0";
	}
}

export function buildProgram(): Command {
	const paths = repoPaths();
	const program = new Command();
	program
		.name("flaremail")
		.description("Configure, inspect, and deploy a FlareMail instance")
		.version(version(paths.root));

	program
		.command("init")
		.description("Create flaremail.conf.jsonc and generate .env / wrangler.jsonc")
		.action(async () => {
			const { runInit } = await import("./init.js");
			const conf = await runInit(paths);
			console.log(`wrote ${paths.conf}`);
			console.log(`gate hostname ${conf.gate.hostname}`);
		});

	program
		.command("sync")
		.description("Write .env and wrangler.jsonc from conf")
		.option("--from-example", "Use flaremail.conf.example.jsonc")
		.option("--if-missing", "No-op when wrangler.jsonc already exists")
		.action((opts: { fromExample?: boolean; ifMissing?: boolean }) => {
			const result = sync(paths, {
				fromExample: Boolean(opts.fromExample),
				ifMissing: Boolean(opts.ifMissing),
			});
			if (!result.wrote) {
				console.log("wrangler.jsonc already present");
				return;
			}
			console.log(`materialized from ${result.source}`);
		});

	program
		.command("status")
		.description("List FlareMail Cloudflare resources")
		.option("--json", "JSON output")
		.action(async (opts: { json?: boolean }) => {
			const { requireAdapter, requireConf } = await import("./ops.js");
			const { collectSnapshot: collect } = await import("./health.js");
			const conf = requireConf(paths);
			const snapshot = await collect(conf, requireAdapter(conf));
			if (opts.json) {
				console.log(JSON.stringify(snapshot, null, 2));
				return;
			}
			printStatus(conf, snapshot);
		});

	program
		.command("doctor")
		.description("Check whether Cloudflare resources match conf")
		.option("--json", "JSON output")
		.action(async (opts: { json?: boolean }) => {
			const { requireAdapter, requireConf } = await import("./ops.js");
			const { collectSnapshot: collect, evaluateHealth, formatReport } =
				await import("./health.js");
			const conf = requireConf(paths);
			const report = evaluateHealth(conf, await collect(conf, requireAdapter(conf)));
			if (opts.json) {
				console.log(JSON.stringify(report, null, 2));
			} else {
				console.log(formatReport(report));
			}
			if (!report.healthy) process.exitCode = 1;
		});

	program
		.command("apply")
		.description("Create or repair Cloudflare resources (no Worker code push)")
		.option("--yes", "Skip confirmation")
		.option("--json", "JSON output")
		.action(async (opts: { yes?: boolean; json?: boolean }) => {
			const { confirmOrYes } = await import("./confirm.js");
			const { requireAdapter, requireConf } = await import("./ops.js");
			const { applyInfrastructure } = await import("./apply.js");
			const { formatReport } = await import("./health.js");
			const conf = requireConf(paths);
			await confirmOrYes(Boolean(opts.yes), "Apply Cloudflare infrastructure changes?");
			const result = await applyInfrastructure(
				conf,
				paths,
				requireAdapter(conf),
				(line) => {
					if (!opts.json) console.log(line);
				},
			);
			if (opts.json) {
				console.log(JSON.stringify(result, null, 2));
			} else {
				console.log(formatReport(result.report));
			}
			if (!result.report.healthy) process.exitCode = 1;
		});

	program
		.command("deploy")
		.description("Materialize, apply, migrate, and deploy Workers")
		.option("--yes", "Skip confirmation")
		.option("--core", "Core only (migrate + core Worker)")
		.option("--gate", "Gate only (web build + gate Worker)")
		.action(async (opts: { yes?: boolean; core?: boolean; gate?: boolean }) => {
			const { confirmOrYes } = await import("./confirm.js");
			const { requireConf } = await import("./ops.js");
			const { deploy } = await import("./deploy.js");
			const conf = requireConf(paths);
			const target = deployTarget(opts);
			await confirmOrYes(Boolean(opts.yes), `Deploy ${target}?`);
			await deploy({
				conf,
				paths,
				target,
				log: (line) => console.log(line),
			});
		});

	program
		.command("dev")
		.description("Materialize then run local core + gate")
		.action(async () => {
			const { requireConf } = await import("./ops.js");
			const { startDev } = await import("./deploy.js");
			const conf = requireConf(paths);
			await startDev(conf, paths, (line) => console.log(line));
		});

	return program;
}

export async function runCli(argv: string[]): Promise<void> {
	if (argv.length <= 2) {
		if (!process.stdout.isTTY || !process.stdin.isTTY) {
			console.error("non-interactive: pass a command (see flaremail --help)");
			process.exitCode = 2;
			return;
		}
		const { startTui } = await import("./tui/index.js");
		await startTui(repoPaths());
		return;
	}
	await buildProgram().parseAsync(argv);
}

function deployTarget(opts: { core?: boolean; gate?: boolean }): DeployTarget {
	if (opts.core && opts.gate) return "all";
	if (opts.core) return "core";
	if (opts.gate) return "gate";
	return "all";
}

function printStatus(conf: Conf, snapshot: ActualSnapshot): void {
	console.log(`account  ${conf.cloudflare.accountId}`);
	console.log(`core     ${conf.core.workerName} ${snapshot.core ? "present" : "missing"}`);
	console.log(`gate     ${conf.gate.workerName} ${snapshot.gate ? "present" : "missing"}`);
	const hd =
		snapshot.hyperdrives.find((item) => item.id === conf.database.hyperdrive.id) ??
		snapshot.hyperdrives.find((item) => item.name === conf.database.hyperdrive.name);
	console.log(`hyperdrive ${hd ? `${hd.name} ${hd.id}` : "missing"}`);
	console.log(
		`r2       ${snapshot.r2Buckets.includes(conf.r2.bucketName) ? conf.r2.bucketName : "missing"}`,
	);
	const hostname = gateHostname(conf);
	const attached = snapshot.domains.find((domain) => domain.hostname === hostname);
	console.log(`hostname ${hostname} ${attached ? "attached" : "missing"}`);
	for (const mail of snapshot.mail) {
		const routing = mail.routing?.enabled ? "routing on" : "routing off";
		const catchAll = mail.catchAll?.worker ?? "no catch-all";
		console.log(`mail     ${mail.domain} ${routing}; ${catchAll}`);
	}
}
