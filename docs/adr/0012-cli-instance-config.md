# CLI owns instance config; Wrangler files are generated

FlareMail is self-hosted: each **instance** has account-specific Hyperdrive ids, a **gate hostname**, secrets, and Cloudflare tokens. Those used to live in committed `wrangler.jsonc` plus two `.env` files, so git mixed product structure with one operator's deployment.

**Decision:** `flaremail.conf.jsonc` (gitignored) is the only instance file. `@flaremail/cli` generates `apps/core/.env`, `apps/web/.env`, and both Workers' `wrangler.jsonc` (also gitignored). Templates for Worker shape (bindings, crons, rate limits) live in the CLI. Operators and CI run `flaremail` (TUI or commands); they do not edit Wrangler or dotenv by hand.

**Considered:** keep instance ids in git and patch them; inject at deploy without writing files. Rejected — Wrangler/Vitest/Drizzle still need files on disk, and committed ids leak a private deployment into the product repo.

**Consequences:** clone → `flaremail init` (or copy the example) → `flaremail sync` / `deploy`. Tests use `flaremail sync --from-example --if-missing`.
