import { describe, expect, it } from "vitest";

import { parseConf } from "./config.js";
import type { ActualSnapshot } from "./health.js";
import { evaluateHealth } from "./health.js";

const conf = parseConf(`{
	"cloudflare": { "accountId": "abc", "apiToken": "tok" },
	"gate": { "hostname": "mail.example.com" },
	"database": {
		"url": "postgresql://u:p@localhost/db",
		"hyperdrive": { "name": "flaremail-db", "id": "hd1" }
	},
	"r2": { "bucketName": "flaremail-bucket" },
	"secrets": { "SESSION_SECRET": "s", "OIDC_SIGNING_JWK": "{}" },
	"mailDomains": ["example.com"]
}`);

function snapshot(over: Partial<ActualSnapshot> = {}): ActualSnapshot {
	return {
		auth: { ok: true },
		hyperdrives: [{ id: "hd1", name: "flaremail-db", cachingDisabled: true }],
		r2Buckets: ["flaremail-bucket"],
		core: {
			name: "flaremail-core",
			workersDev: false,
			previewUrls: false,
			webOrigin: "https://mail.example.com",
			bindings: ["HYPERDRIVE", "BUCKET"],
			serviceTargets: [],
		},
		gate: {
			name: "flaremail-gate",
			workersDev: null,
			previewUrls: null,
			webOrigin: null,
			bindings: ["CORE"],
			serviceTargets: ["flaremail-core"],
		},
		coreSecrets: ["SESSION_SECRET", "OIDC_SIGNING_JWK"],
		domains: [{ hostname: "mail.example.com", service: "flaremail-gate" }],
		mail: [
			{
				domain: "example.com",
				zoneId: "zone1",
				routing: { enabled: true },
				catchAll: { enabled: true, worker: "flaremail-core" },
				dns: [
					{ type: "TXT", name: "example.com", content: "v=spf1 include:_spf.mx.cloudflare.net ~all" },
					{ type: "CNAME", name: "cf2024-1._domainkey.example.com", content: "x.dkim.cloudflare.com" },
				],
			},
		],
		...over,
	};
}

describe("evaluateHealth", () => {
	it("is healthy when desired matches actual", () => {
		const report = evaluateHealth(conf, snapshot());
		expect(report.healthy).toBe(true);
	});

	it("flags missing hyperdrive as repairable", () => {
		const report = evaluateHealth(conf, snapshot({ hyperdrives: [] }));
		const check = report.checks.find((item) => item.id === "hyperdrive");
		expect(check?.status).toBe("missing");
		expect(check?.repairable).toBe(true);
		expect(report.healthy).toBe(false);
	});

	it("does not auto-repair outbound DNS", () => {
		const report = evaluateHealth(
			conf,
			snapshot({
				mail: [
					{
						domain: "example.com",
						zoneId: "zone1",
						routing: { enabled: true },
						catchAll: { enabled: true, worker: "flaremail-core" },
						dns: [],
					},
				],
			}),
		);
		const check = report.checks.find((item) => item.id === "outbound-dns:example.com");
		expect(check?.repairable).toBe(false);
		expect(check?.status).toBe("drift");
	});
});
