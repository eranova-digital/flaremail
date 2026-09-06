import { render } from "ink";

import type { RepoPaths } from "../paths.js";
import { App } from "./App.js";

export async function startTui(paths: RepoPaths): Promise<void> {
	const instance = render(<App paths={paths} />);
	await instance.waitUntilExit();
}
