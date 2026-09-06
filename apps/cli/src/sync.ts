import { confExists, loadConfFile, parseConf, type Conf } from "./config.js";
import { materialize } from "./materialize.js";
import { type RepoPaths, wranglerFilesExist } from "./paths.js";
import { readFileSync } from "node:fs";

export type SyncOptions = {
	fromExample?: boolean;
	ifMissing?: boolean;
};

export function loadConfForSync(paths: RepoPaths, fromExample: boolean): Conf {
	const path = fromExample ? paths.exampleConf : paths.conf;
	if (fromExample) {
		return parseConf(readFileSync(paths.exampleConf, "utf8"));
	}
	return loadConfFile(path);
}

export function sync(paths: RepoPaths, options: SyncOptions = {}): { wrote: boolean; source: string } {
	if (options.ifMissing && wranglerFilesExist(paths)) {
		return { wrote: false, source: "existing" };
	}

	if (options.fromExample) {
		const conf = parseConf(readFileSync(paths.exampleConf, "utf8"));
		materialize(conf, paths);
		return { wrote: true, source: paths.exampleConf };
	}

	if (confExists(paths.conf)) {
		materialize(loadConfFile(paths.conf), paths);
		return { wrote: true, source: paths.conf };
	}

	const conf = parseConf(readFileSync(paths.exampleConf, "utf8"));
	materialize(conf, paths);
	return { wrote: true, source: paths.exampleConf };
}
