import { config } from "dotenv";

/**
 * Local `wrangler dev` / Vitest do not connect through Hyperdrive. The Worker still
 * reads `env.HYPERDRIVE.connectionString`, but Wrangler substitutes a direct Postgres
 * URL from CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_<BINDING>.
 *
 * We source that from DATABASE_URL (direct Neon) so you only maintain one local URL.
 * Deployed Workers use the Hyperdrive binding instead — DATABASE_URL is not loaded there.
 *
 * @see https://developers.cloudflare.com/hyperdrive/configuration/local-development/
 */
export function syncLocalDbEnv(options = {}) {
	const { requireDatabaseUrl = false } = options;

	config();

	if (!process.env.DATABASE_URL?.trim()) {
		if (requireDatabaseUrl) {
			console.error(
				"DATABASE_URL is required in .env (direct Neon Postgres URL for local dev and migrations).",
			);
			console.error(
				"Do not use a Hyperdrive connection string locally — Hyperdrive is not available during wrangler dev.",
			);
			process.exit(1);
		}

		return false;
	}

	process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE =
		process.env.DATABASE_URL.trim();

	return true;
}
