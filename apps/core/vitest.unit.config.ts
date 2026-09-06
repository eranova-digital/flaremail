import { config } from "dotenv";
import { defineConfig } from "vitest/config";

import { WORKER_SPECS } from "./vitest.worker-specs";

config({ path: ".env" });

export default defineConfig({
	test: {
		name: "unit",
		environment: "node",
		include: ["test/**/*.spec.ts"],
		exclude: WORKER_SPECS,
	},
});
