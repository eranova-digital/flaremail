# `@flaremail/cli` — `flaremail`

Operator and CI entry for a FlareMail **instance**. Configure, inspect, and deploy from here — not by editing Wrangler or dotenv files.

Source of truth: gitignored repo-root `flaremail.conf.jsonc` ([ADR-0012](../../docs/adr/0012-cli-instance-config.md)). The CLI writes generated `apps/core/.env`, `apps/web/.env`, `apps/core/wrangler.jsonc`, and `apps/gate/wrangler.jsonc`. Do not edit those by hand.

```bash
npx flaremail                 # TUI (TTY only)
npx flaremail init
npx flaremail deploy --yes
```

---

## Commands

| Command | What |
|---------|------|
| *(no args, TTY)* | Interactive TUI |
| `init` | Wizard → `flaremail.conf.jsonc` + generated files |
| `sync` | Write generated files from conf |
| `status` | List FlareMail Cloudflare resources |
| `doctor` | Health vs conf (exit `1` if unhealthy) |
| `apply` | Create/repair CF resources (no Worker code push) |
| `deploy` | Materialize → apply → migrate → core → web build → gate |
| `dev` | Materialize then local core + gate |

| Flag | Where | Meaning |
|------|--------|---------|
| `--yes` | `apply`, `deploy` | Required when stdin is not a TTY |
| `--json` | `status`, `doctor`, `apply` | Machine-readable output |
| `--core` / `--gate` | `deploy` | Ship one Worker (core includes migrate) |
| `--from-example` | `sync` | Use [`flaremail.conf.example.jsonc`](../../flaremail.conf.example.jsonc) |
| `--if-missing` | `sync` | No-op when generated Wrangler files already exist |

Non-interactive sessions must pass a subcommand (`exit 2` otherwise).

Env overrides: `FLAREMAIL_CONF` (path to conf), `CLOUDFLARE_API_TOKEN` (overrides `cloudflare.apiToken`).

---

## TUI

`npx flaremail` with a TTY. Keys: `d` doctor, `a` apply, `p` deploy, `s` sync, `q` quit.

---

## First install

Needs a **Cloudflare** account, a **Neon** project (direct Postgres URL, not the serverless HTTP endpoint), and **Node.js 20+**.

1. Create a [Cloudflare API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) with Workers, Hyperdrive, R2, Email Routing, Workers custom domains, and zone DNS read.
2. Clone, `npm install`, then:

```bash
npx flaremail init
npx flaremail deploy --yes
```

`init` can generate `SESSION_SECRET` and the OIDC signing JWK. List mail **Domains** in `mailDomains` so Email Routing catch-all → **core** is applied. Outbound SPF/DKIM is reported by `doctor` and is **not** rewritten.

3. Open the **gate hostname**. Complete intendant bootstrap if prompted.

Alternatively copy [`flaremail.conf.example.jsonc`](../../flaremail.conf.example.jsonc) → `flaremail.conf.jsonc`, edit, then `npx flaremail sync` / `deploy`.

Never commit `flaremail.conf.jsonc`. `database.url` is for migrations and local core only — never uploaded to Cloudflare.

---

## Conf

```jsonc
{
  "cloudflare": { "accountId": "", "apiToken": "" },
  "gate": { "workerName": "flaremail-gate", "hostname": "mail.example.com" },
  "core": { "workerName": "flaremail-core" },
  "database": {
    "url": "postgresql://…",
    "hyperdrive": { "name": "flaremail-db", "id": "" }
  },
  "r2": { "bucketName": "flaremail-bucket" },
  "secrets": { "SESSION_SECRET": "", "OIDC_SIGNING_JWK": {} },
  "mailDomains": ["example.com"],
  "web": { "apiProxyTarget": "https://mail.example.com" }
}
```

| Field | Role |
|-------|------|
| `cloudflare.accountId` / `apiToken` | Account + token (token may be `CLOUDFLARE_API_TOKEN` instead) |
| `gate.hostname` | Public **gate hostname**; becomes `WEB_ORIGIN` and the Workers custom domain |
| `database.url` | Direct Neon URL (local + migrations) |
| `database.hyperdrive.id` | Filled in by `apply` / `deploy` after create |
| `mailDomains` | Zones to enable Email Routing catch-all → core |
| `secrets` | Worker secrets only (`SESSION_SECRET`, `OIDC_SIGNING_JWK`) |

Hyperdrive is created with query caching **disabled**.

---

## doctor / apply / deploy

| | doctor | apply | deploy |
|-|--------|-------|--------|
| Auth, Hyperdrive, R2 | check | create / disable cache | yes |
| Email Routing catch-all | check | enable + point at core | yes |
| Gate custom domain | check | attach | yes (also in generated Wrangler) |
| Outbound SPF/DKIM | check only | no | no |
| DB migrate + Worker code | no | no | yes |
| Secrets upload | check | `wrangler secret bulk` if core exists | with core deploy |

`DATABASE_URL` is never a Worker secret.

---

## Updates

```bash
git pull
npm install   # if package-lock.json changed
npx flaremail deploy --yes
```

| Situation | Command |
|-----------|---------|
| Schema / API | `npx flaremail deploy --yes` |
| Secrets / gate hostname | edit conf → `npx flaremail deploy --core --yes` |
| UI only | `npx flaremail deploy --gate --yes` |
| CF drift | `npx flaremail doctor` then `npx flaremail apply --yes` |

---

## CI

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs `npx flaremail sync --from-example` then tests (no Cloudflare token).

[`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) writes conf from secret `FLAREMAIL_CONF` and runs `npx flaremail deploy --yes` with `CLOUDFLARE_API_TOKEN`. GitHub Environment: `production` (`main`), `staging` (`development`).

---

## Local development

```bash
npx flaremail sync
npx flaremail dev          # or: npm run dev
npm run web:dev            # Vite; API_PROXY_TARGET from conf
```

Prefer pointing the web proxy at a **deployed** gate. Local email is unreliable.

Tests: `sync --from-example --if-missing` runs automatically before core Vitest when Wrangler files are absent.
