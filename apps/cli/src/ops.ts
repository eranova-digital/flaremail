import { createCloudflareAdapter } from "./cloudflare.js";
import { confExists, loadConfFile, type Conf } from "./config.js";
import type { RepoPaths } from "./paths.js";

export function requireConf(paths: RepoPaths): Conf {
	if (!confExists(paths.conf)) {
		throw new Error(
			`Missing ${paths.conf}. Run \`flaremail init\` or copy flaremail.conf.example.jsonc.`,
		);
	}
	return loadConfFile(paths.conf);
}

export function requireAdapter(conf: Conf) {
	return createCloudflareAdapter(conf);
}
