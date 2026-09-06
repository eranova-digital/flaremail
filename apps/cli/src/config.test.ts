import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
	parseConf,
	productionWebOrigin,
	writeHyperdriveId,
} from "./config.js";

const SAMPLE = `{
	"cloudflare": { "accountId": "abc", "apiToken": "tok" },
	"gate": { "hostname": "https://mail.example.com/" },
	"database": {
		"url": "postgresql://u:p@localhost:5432/db",
		"hyperdrive": { "name": "flaremail-db", "id": "" }
	},
	"r2": { "bucketName": "flaremail-bucket" },
	"secrets": {
		"SESSION_SECRET": "secret-secret-secret-secret-secret",
		"OIDC_SIGNING_JWK": { "kty": "EC", "kid": "flaremail" }
	},
	"mailDomains": ["example.com"]
}`;

describe("parseConf", () => {
	it("fills defaults and normalizes JWK + hostname", () => {
		const conf = parseConf(SAMPLE);
		expect(conf.core.workerName).toBe("flaremail-core");
		expect(conf.gate.workerName).toBe("flaremail-gate");
		expect(productionWebOrigin(conf)).toBe("https://mail.example.com");
		expect(JSON.parse(conf.secrets.OIDC_SIGNING_JWK)).toMatchObject({
			kty: "EC",
			kid: "flaremail",
		});
	});

	it("patches hyperdrive id without dropping comments", () => {
		const dir = mkdtempSync(join(tmpdir(), "flaremail-conf-"));
		const path = join(dir, "flaremail.conf.jsonc");
		writeFileSync(
			path,
			`{\n\t// keep me\n\t"cloudflare": { "accountId": "abc" },\n\t"gate": { "hostname": "mail.example.com" },\n\t"database": { "url": "postgresql://u:p@localhost/db", "hyperdrive": { "id": "" } },\n\t"r2": { "bucketName": "b" },\n\t"secrets": { "SESSION_SECRET": "s", "OIDC_SIGNING_JWK": "{}" }\n}\n`,
		);
		writeHyperdriveId(path, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
		const text = readFileSync(path, "utf8");
		expect(text).toContain("keep me");
		expect(text).toContain("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
	});
});
