import { spawnSync } from "node:child_process";

import { syncLocalDbEnv } from "./sync-local-db-env.mjs";

syncLocalDbEnv({ requireDatabaseUrl: true });

const [command, ...args] = process.argv.slice(2);
if (!command) {
	console.error("Usage: node scripts/with-env.mjs <command> [args...]");
	process.exit(1);
}

const result = spawnSync(command, args, {
	stdio: "inherit",
	env: process.env,
	shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
