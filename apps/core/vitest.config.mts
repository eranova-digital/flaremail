import { syncLocalDbEnv } from "./scripts/sync-local-db-env.mjs";
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

// Worker tests must not write to Postgres. Sync DATABASE_URL only when present so
// the Hyperdrive binding can initialize; never require a live DB for the suite.
const hasDb = syncLocalDbEnv({ requireDatabaseUrl: false });
if (!hasDb) {
	process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE =
		"postgresql://vitest:vitest@127.0.0.1:5432/vitest_unused";
}

export default defineWorkersConfig({
	test: {
		fileParallelism: false,
		poolOptions: {
			workers: {
				wrangler: { configPath: "./wrangler.jsonc" },
				// EMAIL is `remote: true` in wrangler.jsonc for wrangler dev.
				// CI has no Wrangler login; keep Vitest on local simulations.
				remoteBindings: false,
			},
		},
	},
});
