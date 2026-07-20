# Flaremail

Self-hosted email for your domains. Receive catch-all mail, read and send from shared mailboxes, and manage everything through a web UI or HTTP API.

Flaremail runs on **Cloudflare** (Email Routing, Email Sending, Workers, R2, Hyperdrive) with **Neon Postgres** for metadata. You keep the data; Cloudflare carries the mail and edge compute.

---

## What it is

| Capability | How |
|------------|-----|
| Inbound mail | Cloudflare Email Routing invokes the private **core** Worker’s `email()` handler |
| Storage | Message metadata in Neon; raw `.eml` and attachments in R2 |
| Outbound mail | Cloudflare Email Sending from core |
| HTTP API | Versioned REST at `/api/v1` (auth, domains, mailboxes, threads, send/reply, …) |
| Web UI | React SPA served by the public **gate** Worker |

**Audience**

- **Installing operators** (IT / self-hosters) — deploy and maintain an instance
- **Day-to-day operators** — accounts who use mail and settings in the UI
- **Developers / maintainers** — change the product and ship updates

Domain language (Domain, mailbox, gate, core, intendant, …) lives in [`docs/CONTEXT.md`](./docs/CONTEXT.md).

---

## How the pieces fit

```
Browser ──► flaremail-gate (public)
              ├─ static SPA (built from apps/web)
              └─ /api/*  ──service binding──►  flaremail-core (private)

Email Routing / crons / R2 / Hyperdrive ──► flaremail-core only
```

| Package | CF Worker | Role |
|---------|-----------|------|
| [`apps/web`](./apps/web) | *(source only)* | React/Vite UI |
| [`apps/gate`](./apps/gate) | `flaremail-gate` | Public edge: assets + `/api` proxy |
| [`apps/core`](./apps/core) | `flaremail-core` | Email, API, crons, bindings |

- **Domain** — a mail-accepting domain in Flaremail (e.g. `acme.com`)
- **Gate hostname** — the public host attached to gate (e.g. `mail.acme.com`)

Same-origin cookies: the browser talks only to the gate hostname; `/api` is proxied to core. See [ADR-0010](./docs/adr/0010-gate-and-private-core.md).

---

## Quick links

| Doc | Contents |
|-----|----------|
| [docs/README.md](./docs/README.md) | Index of glossary, ADRs, API, auth specs |
| [docs/CONTEXT.md](./docs/CONTEXT.md) | Ubiquitous language |
| [docs/API.md](./docs/API.md) | Human API reference |
| [apps/core/README.md](./apps/core/README.md) | Core architecture |
| [apps/gate/README.md](./apps/gate/README.md) | Gate architecture |
| [apps/web/README.md](./apps/web/README.md) | Web app architecture |

---

## Architecture (overview)

### Request paths

**Web + API (browser)**

1. User opens the **gate hostname**.
2. Gate serves the SPA (or SPA fallback for client routes).
3. SPA calls `/api/v1/...` on the same origin.
4. Gate forwards `/api/*` to core via `env.CORE.fetch(request)`.
5. Core authenticates (session cookie or API key / OIDC) and runs the handler.

**Inbound mail**

1. MX / Email Routing delivers to Cloudflare.
2. Catch-all (or address rule) targets Worker **`flaremail-core`** by name.
3. Core `email()` resolves mailbox (exact / alias / catch-all), stores Postgres + R2, updates threads.

**Outbound mail**

1. UI or API issues send/reply/forward (or draft send) on `/api/v1`.
2. Core builds MIME and sends via the `EMAIL` binding; persists the sent message.

**Scheduled work**

Core cron (`*/2 * * * *`) handles domain-validation timeouts and log retention purge.

### Monorepo layout

```
apps/
  core/     Private Worker — email, API, DB, R2, Hyperdrive
  gate/     Public Worker — SPA assets + /api proxy
  web/      React SPA source (built into gate)
  3p-demo/  Optional OIDC relying-party demo
packages/   Shared libraries (i18n, mail quoting, …)
docs/       Glossary, ADRs, API, auth specs
```

### Stack

| Layer | Technology |
|-------|------------|
| Edge | Cloudflare Workers (gate + core) |
| Mail | Email Routing + Email Sending |
| DB | Neon Postgres via Hyperdrive + Drizzle |
| Blobs | R2 |
| UI | React, Vite, TanStack Query, TipTap |

---

# For installing operators

Deploy and keep an instance running. You need a Cloudflare account, a Neon project, and Node.js 20+.

## First-time setup

### 1. Clone and install

```bash
git clone <repo-url> flaremail
cd flaremail
npm install
npx wrangler login
```

### 2. Neon database

1. Create a Neon project.
2. Copy the **direct** Postgres connection string (not the serverless HTTP endpoint).
3. Create env from the example:

```bash
cp apps/core/.env.example apps/core/.env
```

4. Set `DATABASE_URL` in `apps/core/.env`.

There is **no root `.env`**. Only `apps/core/.env` holds secrets and `DATABASE_URL`. Never commit `.env`.

### 3. Hyperdrive

Create Hyperdrive against the same Neon database, then **disable query caching** (cached `SELECT`s make the UI look stale after writes):

```bash
npx wrangler hyperdrive create flaremail-db \
  --connection-string="<your-neon-direct-url>"

npx wrangler hyperdrive update <HYPERDRIVE_ID> --caching-disabled true
```

Put the Hyperdrive **id** into `apps/core/wrangler.jsonc` (replace the sample id). The id is account-specific, not a secret — anyone still needs your Cloudflare account to use it.

### 4. Configure secrets and vars

In `apps/core/.env`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Direct Neon URL — migrations + local core only (never uploaded to CF) |
| `SESSION_SECRET` | Long random secret for session cookies |
| `OIDC_SIGNING_JWK` | One-line ES256 private JWK JSON ([ADR-0007](./docs/adr/0007-oidc-token-signing-es256.md)) |

Generate a signing JWK:

```bash
node -e "const {generateKeyPairSync}=require('crypto');const {exportJWK}=require('jose');(async()=>{const {privateKey}=generateKeyPairSync('ec',{namedCurve:'P-256'});const jwk=await exportJWK(privateKey);jwk.kid='flaremail';jwk.alg='ES256';jwk.use='sig';console.log(JSON.stringify(jwk))})()"
```

In `apps/core/wrangler.jsonc` → `vars.WEB_ORIGIN`, set the final **gate hostname** URL (e.g. `https://mail.example.com`). That origin must match what browsers use for the SPA and `/api` (cookies + OIDC redirects).

### 5. Deploy Workers

```bash
npm run deploy
```

What this does:

1. **core:** run DB migrations → upload only `secrets.required` (`SESSION_SECRET`, `OIDC_SIGNING_JWK`) via a temporary secrets file → `wrangler deploy` as `flaremail-core` (no public `workers.dev` / Preview URLs)
2. **gate:** `vite build` for `apps/web` → deploy `flaremail-gate` with assets from `apps/web/dist` and a service binding to core

Deploy **core before gate** (the binding target must exist). R2 can be provisioned from the core wrangler config.

### 6. Attach the gate hostname

In the Cloudflare dashboard → Workers → **flaremail-gate** → add your custom domain (**gate hostname**).

Confirm `WEB_ORIGIN` matches that URL, then redeploy core if you changed it:

```bash
npm run core:deploy
```

### 7. Email Routing and Sending

For each mail **Domain** (e.g. `acme.com`):

1. Enable **Email Routing** on the zone.
2. Catch-all (or address rules) → **Send to a Worker** → **`flaremail-core`**.
3. Configure **Email Sending** DNS for outbound.

Order: Workers deployed first, then Email Routing → core, then (or in parallel) gate hostname on gate.

### 8. First sign-in

Open the **gate hostname**. Complete intendant bootstrap if prompted (break-glass account — see [ADR-0005](./docs/adr/0005-intendant-break-glass-account.md)). Add domains and mailboxes in Settings.

Optional local UI tooling:

```bash
cp apps/web/.env.example apps/web/.env
# API_URL=/api/v1
# API_PROXY_TARGET=https://your-gate-hostname
```

Production does not need a separate static host — gate serves the SPA.

---

## Updating an existing install

When `main` (or your tracked release branch) moves forward:

```bash
cd flaremail
git pull
npm install          # if package-lock.json changed
npm run deploy       # migrate + core + web build + gate
```

Notes:

- Migrations run as part of `core:deploy`. Read release notes / commit messages if a migration needs downtime.
- If Hyperdrive, R2, or wrangler binding names change upstream, merge those config edits and re-apply any local ids (Hyperdrive id, `WEB_ORIGIN`, secrets in `.env`).
- Re-attach Email Routing only if the **core** Worker name changes (it should stay `flaremail-core`).
- After changing `WEB_ORIGIN` or secrets in `.env`, `npm run core:deploy` is enough; UI-only changes are covered by full `npm run deploy` or `npm run gate:deploy`.

Rollback: redeploy a previous git revision with the same `npm run deploy` flow, or use Cloudflare Worker version rollback for a single Worker if you only need an emergency revert of that Worker’s code.

---

# For developers and maintainers

## Development flow

**Preferred day-to-day:** iterate the UI against a **deployed** stack.

```bash
cp apps/web/.env.example apps/web/.env
# API_PROXY_TARGET=https://your-gate-hostname
npm run web:dev      # Vite :5173, proxies /api to the gate
```

Local email is unreliable; use the deployed core for mail-path testing.

**Optional full local Workers:**

```bash
npm run dev          # core:dev + gate:dev (concurrently)
# Service binding connects when both sessions are up
npm run web:dev      # point API_PROXY_TARGET at http://localhost:8787
```

| Command | Purpose |
|---------|---------|
| `npm run core:dev` | Core with local Hyperdrive stub from `DATABASE_URL` |
| `npm run gate:dev` | Gate on `:8787` |
| `npm run core:test` / `web:test` | Vitest |
| `npm run apigen` | Regenerate OpenAPI JSON + web client |
| `npm run typegen` | Regenerate core Wrangler types |
| `npm run db:*` | Drizzle against Neon via `apps/core` |

After schema changes: edit `apps/core/src/db/schema.ts` → `npm run db:generate` → review SQL → `npm run db:migrate` (or rely on deploy).

After OpenAPI changes: edit `apps/core/openapi.yaml` → `npm run apigen`.

## Deployment flow

```bash
npm run deploy                 # production path (core then gate)
npm run core:deploy            # migrate + secrets filter + core only
npm run gate:deploy            # web build + gate only
```

Secrets: `apps/core/scripts/deploy-with-secrets.mjs` reads `secrets.required` from wrangler, fails if any key is missing/empty in `.env`, writes a temp JSON secrets file, deploys, deletes the file. `DATABASE_URL` is never uploaded.

## Where to change what

| Concern | Start here |
|---------|------------|
| HTTP routes / OpenAPI | `apps/core` — see [core README](./apps/core/README.md) |
| Inbound/outbound mail | `apps/core` email handler + `services/outbound-mail` |
| Public edge / SPA hosting | `apps/gate` — see [gate README](./apps/gate/README.md) |
| UI routes / compose / settings | `apps/web` — see [web README](./apps/web/README.md) |
| Shared terms | `docs/CONTEXT.md` |
| Hard decisions | `docs/adr/` |

Auth design history: `docs/specs/auth/`. Cloudflare API details for agents: `AGENTS.md` (always fetch current Workers docs).

## Scripts reference

| Command | Description |
|---------|-------------|
| `npm run deploy` | Migrate + deploy core, then build web + deploy gate |
| `npm run dev` | Local core + gate |
| `npm run core:dev` / `core:deploy` / `core:test` | Core lifecycle |
| `npm run gate:dev` / `gate:deploy` | Gate lifecycle |
| `npm run web:dev` / `web:build` / `web:test` | Web lifecycle |
| `npm run db:migrate` / `db:generate` / `db:studio` | Database |
| `npm run apigen` / `typegen` | Codegen |
