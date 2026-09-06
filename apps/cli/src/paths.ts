import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

export type RepoPaths = {
	root: string;
	conf: string;
	exampleConf: string;
	core: string;
	gate: string;
	web: string;
	coreEnv: string;
	webEnv: string;
	coreWrangler: string;
	gateWrangler: string;
};

export function findRepoRoot(start = process.cwd()): string {
	let dir = start;
	for (;;) {
		if (
			existsSync(join(dir, "flaremail.conf.example.jsonc")) &&
			existsSync(join(dir, "apps", "core")) &&
			existsSync(join(dir, "apps", "gate"))
		) {
			return dir;
		}
		const parent = dirname(dir);
		if (parent === dir) {
			throw new Error(
				"Not inside a FlareMail repo (missing flaremail.conf.example.jsonc).",
			);
		}
		dir = parent;
	}
}

export function repoPaths(root = findRepoRoot()): RepoPaths {
	const conf =
		process.env.FLAREMAIL_CONF?.trim() || join(root, "flaremail.conf.jsonc");
	return {
		root,
		conf,
		exampleConf: join(root, "flaremail.conf.example.jsonc"),
		core: join(root, "apps", "core"),
		gate: join(root, "apps", "gate"),
		web: join(root, "apps", "web"),
		coreEnv: join(root, "apps", "core", ".env"),
		webEnv: join(root, "apps", "web", ".env"),
		coreWrangler: join(root, "apps", "core", "wrangler.jsonc"),
		gateWrangler: join(root, "apps", "gate", "wrangler.jsonc"),
	};
}

export function wranglerFilesExist(paths: RepoPaths): boolean {
	return existsSync(paths.coreWrangler) && existsSync(paths.gateWrangler);
}
