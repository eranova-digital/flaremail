import { syncLocalDbEnv } from "./scripts/sync-local-db-env.mjs";
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

syncLocalDbEnv({ requireDatabaseUrl: true });

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: "./wrangler.jsonc" },
			},
		},
	},
});
