import {
	apiToken,
	type Conf,
	gateHostname,
	productionWebOrigin,
} from "./config.js";
import type {
	CatchAllInfo,
	CloudflareAdapter,
	DnsRecordInfo,
	HyperdriveInfo,
	WorkerDomainInfo,
	WorkerInfo,
} from "./cloudflare.js";
import { REQUIRED_SECRETS } from "./templates.js";

export type CheckStatus = "ok" | "missing" | "drift" | "error" | "skip";

export type HealthCheck = {
	id: string;
	label: string;
	status: CheckStatus;
	detail: string;
	repairable: boolean;
};

export type HealthReport = {
	checks: HealthCheck[];
	healthy: boolean;
};

export type ActualSnapshot = {
	auth: { ok: boolean; error?: string };
	hyperdrives: HyperdriveInfo[];
	r2Buckets: string[];
	core: WorkerInfo | null;
	gate: WorkerInfo | null;
	coreSecrets: string[];
	domains: WorkerDomainInfo[];
	mail: Array<{
		domain: string;
		zoneId: string | null;
		routing: { enabled: boolean } | null;
		catchAll: CatchAllInfo | null;
		dns: DnsRecordInfo[];
	}>;
};

export async function collectSnapshot(
	conf: Conf,
	cf: CloudflareAdapter,
): Promise<ActualSnapshot> {
	const auth = await cf.verifyAccount();
	if (!auth.ok) {
		return {
			auth,
			hyperdrives: [],
			r2Buckets: [],
			core: null,
			gate: null,
			coreSecrets: [],
			domains: [],
			mail: conf.mailDomains.map((domain) => ({
				domain,
				zoneId: null,
				routing: null,
				catchAll: null,
				dns: [],
			})),
		};
	}

	const [hyperdrives, r2Buckets, core, gate, domains] = await Promise.all([
		cf.listHyperdrives(),
		cf.listR2Buckets(),
		cf.getWorker(conf.core.workerName),
		cf.getWorker(conf.gate.workerName),
		cf.listWorkerDomains(),
	]);
	const coreSecrets = core ? await cf.listWorkerSecrets(conf.core.workerName) : [];
	const mail = await Promise.all(
		conf.mailDomains.map(async (domain) => {
			const zoneId = await cf.getZoneId(domain);
			if (!zoneId) {
				return { domain, zoneId: null, routing: null, catchAll: null, dns: [] };
			}
			const [routing, catchAll, dns] = await Promise.all([
				cf.getEmailRouting(zoneId),
				cf.getCatchAll(zoneId),
				cf.listDnsRecords(zoneId),
			]);
			return { domain, zoneId, routing, catchAll, dns };
		}),
	);

	return { auth, hyperdrives, r2Buckets, core, gate, coreSecrets, domains, mail };
}

export function evaluateHealth(conf: Conf, actual: ActualSnapshot): HealthReport {
	const checks: HealthCheck[] = [];
	const tokenPresent = Boolean(apiToken(conf));

	if (!tokenPresent) {
		checks.push({
			id: "auth",
			label: "Cloudflare auth",
			status: "missing",
			detail: "No API token (cloudflare.apiToken or CLOUDFLARE_API_TOKEN)",
			repairable: false,
		});
	} else if (!actual.auth.ok) {
		checks.push({
			id: "auth",
			label: "Cloudflare auth",
			status: "error",
			detail: actual.auth.error || "Account lookup failed",
			repairable: false,
		});
	} else {
		checks.push({
			id: "auth",
			label: "Cloudflare auth",
			status: "ok",
			detail: `account ${conf.cloudflare.accountId}`,
			repairable: false,
		});
	}

	const reachable = actual.auth.ok && tokenPresent;
	if (!reachable) {
		return { checks, healthy: false };
	}

	checks.push(hyperdriveCheck(conf, actual.hyperdrives));
	checks.push(r2Check(conf, actual.r2Buckets));
	checks.push(coreWorkerCheck(conf, actual.core));
	checks.push(secretsCheck(actual.core, actual.coreSecrets));
	checks.push(gateWorkerCheck(conf, actual.gate));
	checks.push(gateHostnameCheck(conf, actual.domains));

	for (const mail of actual.mail) {
		checks.push(emailRoutingCheck(mail));
		checks.push(catchAllCheck(conf, mail));
		checks.push(outboundDnsCheck(mail));
	}

	return {
		checks,
		healthy: checks.every((check) => check.status === "ok" || check.status === "skip"),
	};
}

function hyperdriveCheck(conf: Conf, hyperdrives: HyperdriveInfo[]): HealthCheck {
	const id = conf.database.hyperdrive.id.trim();
	const byId = id ? hyperdrives.find((item) => item.id === id) : undefined;
	const byName = hyperdrives.find((item) => item.name === conf.database.hyperdrive.name);
	const found = byId ?? byName;
	if (!found) {
		return {
			id: "hyperdrive",
			label: "Hyperdrive",
			status: "missing",
			detail: id
				? `id ${id} not found`
				: `named ${conf.database.hyperdrive.name} not found`,
			repairable: true,
		};
	}
	if (id && found.id !== id) {
		return {
			id: "hyperdrive",
			label: "Hyperdrive",
			status: "drift",
			detail: `conf id ${id} != live ${found.id}`,
			repairable: true,
		};
	}
	if (!id) {
		return {
			id: "hyperdrive",
			label: "Hyperdrive",
			status: "drift",
			detail: `exists as ${found.id} but conf has no id`,
			repairable: true,
		};
	}
	if (!found.cachingDisabled) {
		return {
			id: "hyperdrive",
			label: "Hyperdrive",
			status: "drift",
			detail: "query caching is enabled (must be disabled)",
			repairable: true,
		};
	}
	return {
		id: "hyperdrive",
		label: "Hyperdrive",
		status: "ok",
		detail: `${found.name} ${found.id}`,
		repairable: false,
	};
}

function r2Check(conf: Conf, buckets: string[]): HealthCheck {
	if (!buckets.includes(conf.r2.bucketName)) {
		return {
			id: "r2",
			label: "R2 bucket",
			status: "missing",
			detail: conf.r2.bucketName,
			repairable: true,
		};
	}
	return {
		id: "r2",
		label: "R2 bucket",
		status: "ok",
		detail: conf.r2.bucketName,
		repairable: false,
	};
}

function coreWorkerCheck(conf: Conf, core: WorkerInfo | null): HealthCheck {
	if (!core) {
		return {
			id: "core",
			label: "core Worker",
			status: "missing",
			detail: `${conf.core.workerName} — run flaremail deploy`,
			repairable: false,
		};
	}
	if (core.workersDev === true) {
		return {
			id: "core",
			label: "core Worker",
			status: "drift",
			detail: "workers.dev is on (must be off)",
			repairable: false,
		};
	}
	if (core.previewUrls === true) {
		return {
			id: "core",
			label: "core Worker",
			status: "drift",
			detail: "preview URLs are on (must be off)",
			repairable: false,
		};
	}
	const origin = productionWebOrigin(conf);
	if (core.webOrigin && core.webOrigin !== origin) {
		return {
			id: "core",
			label: "core Worker",
			status: "drift",
			detail: `WEB_ORIGIN ${core.webOrigin} != ${origin}`,
			repairable: false,
		};
	}
	return {
		id: "core",
		label: "core Worker",
		status: "ok",
		detail: core.name,
		repairable: false,
	};
}

function secretsCheck(core: WorkerInfo | null, secrets: string[]): HealthCheck {
	if (!core) {
		return {
			id: "secrets",
			label: "core secrets",
			status: "missing",
			detail: "core Worker not deployed",
			repairable: false,
		};
	}
	const missing = REQUIRED_SECRETS.filter((name) => !secrets.includes(name));
	if (missing.length > 0) {
		return {
			id: "secrets",
			label: "core secrets",
			status: "missing",
			detail: missing.join(", "),
			repairable: true,
		};
	}
	return {
		id: "secrets",
		label: "core secrets",
		status: "ok",
		detail: REQUIRED_SECRETS.join(", "),
		repairable: false,
	};
}

function gateWorkerCheck(conf: Conf, gate: WorkerInfo | null): HealthCheck {
	if (!gate) {
		return {
			id: "gate",
			label: "gate Worker",
			status: "missing",
			detail: `${conf.gate.workerName} — run flaremail deploy`,
			repairable: false,
		};
	}
	if (
		gate.serviceTargets.length > 0 &&
		!gate.serviceTargets.includes(conf.core.workerName)
	) {
		return {
			id: "gate",
			label: "gate Worker",
			status: "drift",
			detail: `service binding targets ${gate.serviceTargets.join(", ") || "(none)"}`,
			repairable: false,
		};
	}
	return {
		id: "gate",
		label: "gate Worker",
		status: "ok",
		detail: gate.name,
		repairable: false,
	};
}

function gateHostnameCheck(conf: Conf, domains: WorkerDomainInfo[]): HealthCheck {
	const hostname = gateHostname(conf);
	const attached = domains.find((domain) => domain.hostname === hostname);
	if (!attached) {
		return {
			id: "gate-hostname",
			label: "gate hostname",
			status: "missing",
			detail: `${hostname} not attached`,
			repairable: true,
		};
	}
	if (attached.service !== conf.gate.workerName) {
		return {
			id: "gate-hostname",
			label: "gate hostname",
			status: "drift",
			detail: `${hostname} points at ${attached.service}`,
			repairable: true,
		};
	}
	return {
		id: "gate-hostname",
		label: "gate hostname",
		status: "ok",
		detail: hostname,
		repairable: false,
	};
}

function emailRoutingCheck(mail: ActualSnapshot["mail"][number]): HealthCheck {
	const id = `email-routing:${mail.domain}`;
	if (!mail.zoneId) {
		return {
			id,
			label: `Email Routing (${mail.domain})`,
			status: "missing",
			detail: "zone not in this Cloudflare account",
			repairable: false,
		};
	}
	if (!mail.routing?.enabled) {
		return {
			id,
			label: `Email Routing (${mail.domain})`,
			status: "missing",
			detail: "routing disabled",
			repairable: true,
		};
	}
	return {
		id,
		label: `Email Routing (${mail.domain})`,
		status: "ok",
		detail: "enabled",
		repairable: false,
	};
}

function catchAllCheck(
	conf: Conf,
	mail: ActualSnapshot["mail"][number],
): HealthCheck {
	const id = `catch-all:${mail.domain}`;
	if (!mail.zoneId) {
		return {
			id,
			label: `Catch-all (${mail.domain})`,
			status: "skip",
			detail: "no zone",
			repairable: false,
		};
	}
	if (!mail.catchAll?.enabled || mail.catchAll.worker !== conf.core.workerName) {
		return {
			id,
			label: `Catch-all (${mail.domain})`,
			status: mail.catchAll ? "drift" : "missing",
			detail: mail.catchAll?.worker
				? `worker ${mail.catchAll.worker}`
				: `expected worker ${conf.core.workerName}`,
			repairable: true,
		};
	}
	return {
		id,
		label: `Catch-all (${mail.domain})`,
		status: "ok",
		detail: conf.core.workerName,
		repairable: false,
	};
}

function outboundDnsCheck(mail: ActualSnapshot["mail"][number]): HealthCheck {
	const id = `outbound-dns:${mail.domain}`;
	if (!mail.zoneId) {
		return {
			id,
			label: `Outbound DNS (${mail.domain})`,
			status: "skip",
			detail: "no zone",
			repairable: false,
		};
	}
	const spf = mail.dns.some(
		(record) =>
			record.type === "TXT" && /v=spf1/i.test(record.content) && /cloudflare/i.test(record.content),
	);
	const dkim = mail.dns.some(
		(record) =>
			(record.type === "CNAME" || record.type === "TXT") &&
			/_domainkey/i.test(record.name),
	);
	if (!spf || !dkim) {
		const missing = [!spf ? "SPF" : null, !dkim ? "DKIM" : null].filter(Boolean);
		return {
			id,
			label: `Outbound DNS (${mail.domain})`,
			status: "drift",
			detail: `${missing.join(" + ")} missing (doctor only — not auto-repaired)`,
			repairable: false,
		};
	}
	return {
		id,
		label: `Outbound DNS (${mail.domain})`,
		status: "ok",
		detail: "SPF + DKIM present",
		repairable: false,
	};
}

export function formatReport(report: HealthReport): string {
	const lines = report.checks.map((check) => {
		const mark =
			check.status === "ok" ? "ok" : check.status === "skip" ? "skip" : check.status;
		return `${mark.padEnd(7)} ${check.label}: ${check.detail}`;
	});
	lines.push(report.healthy ? "healthy" : "unhealthy");
	return lines.join("\n");
}
