import { spawnSync } from "node:child_process";
import {
	mkdtempSync,
	readFileSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Parse wrangler.jsonc enough to read secrets.required (strip // and /* */ comments).
 */
function readRequiredSecrets() {
	const raw = readFileSync(resolve(coreRoot, "wrangler.jsonc"), "utf8");
	const json = raw
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "");
	const parsed = JSON.parse(json);
	const required = parsed?.secrets?.required;
	if (!Array.isArray(required) || required.length === 0) {
		throw new Error("wrangler.jsonc must declare secrets.required");
	}
	return required.map(String);
}

/**
 * Filter apps/core/.env to secrets.required only, deploy with --secrets-file,
 * then delete the temp file. Never uploads DATABASE_URL or other non-secret keys.
 */
function main() {
	const required = readRequiredSecrets();
	const envPath = resolve(coreRoot, ".env");
	const loaded = config({ path: envPath });
	if (loaded.error && loaded.error.code !== "ENOENT") {
		console.error(`Failed to read ${envPath}:`, loaded.error.message);
		process.exit(1);
	}

	const missing = [];
	const secrets = {};
	for (const key of required) {
		const value = process.env[key]?.trim();
		if (!value) {
			missing.push(key);
			continue;
		}
		secrets[key] = value;
	}

	if (missing.length > 0) {
		console.error(
			`Missing required secrets in apps/core/.env: ${missing.join(", ")}`,
		);
		console.error(
			"Add the keys listed in wrangler.jsonc secrets.required before deploying.",
		);
		process.exit(1);
	}

	const dir = mkdtempSync(join(tmpdir(), "flaremail-secrets-"));
	const secretsFile = join(dir, "secrets.json");
	writeFileSync(secretsFile, `${JSON.stringify(secrets, null, 2)}\n`, {
		mode: 0o600,
	});

	try {
		const result = spawnSync(
			"wrangler",
			["deploy", "--secrets-file", secretsFile],
			{
				stdio: "inherit",
				cwd: coreRoot,
				env: process.env,
				shell: process.platform === "win32",
			},
		);
		process.exit(result.status ?? 1);
	} finally {
		try {
			unlinkSync(secretsFile);
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

main();
