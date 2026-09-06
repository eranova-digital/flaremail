#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const entry = resolve(root, "../src/index.ts");
const result = spawnSync(
	process.execPath,
	["--import", "tsx", entry, ...process.argv.slice(2)],
	{ stdio: "inherit", env: process.env },
);
if (result.signal) {
	process.kill(process.pid, result.signal);
}
process.exit(result.status ?? 1);
