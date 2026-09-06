# `@flaremail/cli` — `flaremail`

Operator and CI entry for a FlareMail **instance**. Reads `flaremail.conf.jsonc` (gitignored), writes `apps/core` / `apps/gate` / `apps/web` env and Wrangler files, then talks to Cloudflare.

```bash
npx flaremail              # TUI (TTY only)
npx flaremail init
npx flaremail sync
npx flaremail doctor
npx flaremail apply --yes
npx flaremail deploy --yes
```

Non-interactive sessions must pass a subcommand (`exit 2` otherwise). Mutating commands need `--yes` when stdin is not a TTY.

See the [root README](../../README.md) and [ADR-0012](../../docs/adr/0012-cli-instance-config.md).
