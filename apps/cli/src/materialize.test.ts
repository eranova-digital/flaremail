import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseConf } from "./config.js";
import { materialize } from "./materialize.js";
import type { RepoPaths } from "./paths.js";

describe("materialize", () => {
	it("writes wrangler.jsonc and .env from conf", () => {
		const root = mkdtempSync(join(tmpdir(), "flaremail-mat-"));
		const paths: RepoPaths = {
			root,
			conf: join(root, "flaremail.conf.jsonc"),
			exampleConf: join(root, "flaremail.conf.example.jsonc"),
			core: join(root, "apps", "core"),
			gate: join(root, "apps", "gate"),
			web: join(root, "apps", "web"),
			coreEnv: join(root, "apps", "core", ".env"),
			webEnv: join(root, "apps", "web", ".env"),
			coreWrangler: join(root, "apps", "core", "wrangler.jsonc"),
			gateWrangler: join(root, "apps", "gate", "wrangler.jsonc"),
		};
		const conf = parseConf(`{
			"cloudflare": { "accountId": "abc" },
			"gate": { "hostname": "mail.example.com" },
			"database": {
				"url": "postgresql://u:p@db.example:5432/neondb",
				"hyperdrive": { "id": "cccccccccccccccccccccccccccccccc" }
			},
			"r2": { "bucketName": "flaremail-bucket" },
			"secrets": {
				"SESSION_SECRET": "sess",
				"OIDC_SIGNING_JWK": "{\\"kty\\":\\"EC\\"}"
			}
		}`);
		materialize(conf, paths);
		const core = readFileSync(paths.coreWrangler, "utf8");
		expect(core).toContain("flaremail-core");
		expect(core).toContain("cccccccccccccccccccccccccccccccc");
		expect(core).toContain("https://mail.example.com");
		expect(core).toContain("workers_dev");
		const gate = readFileSync(paths.gateWrangler, "utf8");
		expect(gate).toContain("flaremail-gate");
		expect(gate).toContain("custom_domain");
		expect(gate).toContain("mail.example.com");
		expect(readFileSync(paths.coreEnv, "utf8")).toContain("DATABASE_URL=");
		expect(readFileSync(paths.webEnv, "utf8")).toContain("API_PROXY_TARGET=");
	});
});
