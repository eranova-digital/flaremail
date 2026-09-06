#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const entry = resolve(root, "../src/index.ts");
const tsconfig = resolve(root, "../tsconfig.json");
const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
const result = spawnSync(
	process.execPath,
	[tsxCli, "--tsconfig", tsconfig, entry, ...process.argv.slice(2)],
	{ stdio: "inherit", env: process.env },
);
if (result.signal) {
	process.kill(process.pid, result.signal);
}
process.exit(result.status ?? 1);
