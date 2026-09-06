import { confirm, input, password } from "@inquirer/prompts";

import { type Conf, saveConfFile } from "./config.js";
import { materialize } from "./materialize.js";
import type { RepoPaths } from "./paths.js";
import { generateOidcSigningJwk, generateSessionSecret } from "./secrets.js";

export async function runInit(paths: RepoPaths): Promise<Conf> {
	const accountId = await input({ message: "Cloudflare account id" });
	const apiToken = await password({
		message: "Cloudflare API token (blank = CLOUDFLARE_API_TOKEN / wrangler login)",
		mask: "*",
	});
	const hostname = await input({
		message: "Gate hostname (e.g. mail.example.com)",
	});
	const databaseUrl = await input({
		message: "Neon direct Postgres URL",
	});
	const mailRaw = await input({
		message: "Mail domains (comma-separated, optional)",
		default: "",
	});
	const genSecrets = await confirm({
		message: "Generate SESSION_SECRET and OIDC signing JWK?",
		default: true,
	});

	const conf: Conf = {
		cloudflare: { accountId: accountId.trim(), apiToken: apiToken.trim() },
		gate: { workerName: "flaremail-gate", hostname: hostname.trim() },
		core: { workerName: "flaremail-core" },
		database: {
			url: databaseUrl.trim(),
			hyperdrive: { name: "flaremail-db", id: "" },
		},
		r2: { bucketName: "flaremail-bucket" },
		secrets: {
			SESSION_SECRET: genSecrets
				? generateSessionSecret()
				: await password({ message: "SESSION_SECRET", mask: "*" }),
			OIDC_SIGNING_JWK: genSecrets
				? await generateOidcSigningJwk()
				: await input({ message: "OIDC_SIGNING_JWK (one-line JSON)" }),
		},
		mailDomains: mailRaw
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean),
		web: { apiProxyTarget: "" },
	};

	saveConfFile(paths.conf, conf);
	materialize(conf, paths);
	return conf;
}
