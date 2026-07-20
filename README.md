# Flaremail

Self-hosted email for your domains — receive catch-all mail, read and send from shared mailboxes, and manage everything through a web UI or HTTP API.

Built on Cloudflare (Email Routing, Email Sending, Workers, R2) with Postgres (Neon) for metadata.

---

## What Flaremail does

1. **Receives** inbound mail via Cloudflare Email Routing and stores messages in Postgres + R2.
2. **Routes** each message to the right mailbox — exact address, alias, or domain catch-all.
3. **Exposes** a versioned REST API for domains, mailboxes, threads, drafts, send/reply/forward, search, and labels.
4. **Provides** a React web app for day-to-day mail operations.

Inbound mail never hits HTTP; Cloudflare invokes core's `email()` handler directly. Browser API calls go through the **gate** at `/api/v1` (proxied to core).

---

## Using the web app

*For operators and anyone reading mail day to day.*

### Getting started

1. Open the web app (your **gate hostname**, or `http://localhost:5173` with `web:dev`).
2. Go to **Settings → Domains** and add a domain.
3. Configure Cloudflare Email Routing for that domain (see [Self-hosting](#self-hosting) below).
4. Add mailboxes under **Settings → Mailboxes**.
5. Pick a mailbox from the sidebar to read mail.

The app remembers your last mailbox between visits.

### Mailboxes and folders

Each **mailbox** is an address on a domain (`support@example.com`). Mailboxes have a **type**:

| Type | Receives mail | Sends mail | Notes |
|------|---------------|------------|-------|
| `primary` | Yes | Yes | Default user-created mailbox |
| `secondary` | Yes | Yes | Additional receiving address |
| `shared` | Yes | Yes | Team/shared inbox |
| `alias` | Forwards inbound | No | Routes to a target mailbox; nothing stored under the alias |
| `system` | Yes | Yes | Auto-provisioned (`postmaster@`) — cannot edit or delete |
| `blackhole` | No | Yes | Auto-provisioned (`noreply@`) — outbound only; used for system sends |

When you add a domain, Flaremail automatically creates `postmaster@`, `noreply@`, and `abuse@` (alias → postmaster).

**Folders** organize threads per mailbox: inbox, sent, drafts, archived, trash, spam. Blackhole mailboxes only show sent-side folders (no inbox/spam).

**Labels** are per-mailbox tags you can apply to threads (separate from folders).

### Everyday actions

- **Read** threads in the folder sidebar; open a thread to see the full conversation.
- **Compose** new mail, **reply**, or **forward** from the compose UI.
- **Archive, trash, spam, restore**, and **star** threads from thread actions.
- **Search** across subject, body, from, and to within the current mailbox.
- **Settings → Domains** — enable catch-all routing, run **domain readiness** checks (DNS + send/receive loop), view validation history.

Domain readiness is **advisory only** — it does not block mail. Use it to confirm MX records and end-to-end flow before going live.

### Authentication

The web app authenticates to the Worker API with a single **Bearer token** (`API_BEARER_TOKEN`). There is no per-user login in v1 — anyone with the token has full API access. Treat the token like a root password.

---

## Self-hosting

*For the installing operator deploying an instance.*

### Prerequisites

| Service | Purpose |
|---------|---------|
| [Cloudflare](https://dash.cloudflare.com) account | Workers, Email Routing, Email Sending, R2, Hyperdrive |
| [Neon](https://neon.tech) Postgres | Message metadata, threads, domains |
| Node.js 20+ | Build and deploy |

### First-time checklist

1. `npm install` and `npx wrangler login`
2. Create a Neon project; put the **direct** Postgres URL in `apps/core/.env` as `DATABASE_URL`
3. Create Hyperdrive pointing at Neon, **disable query caching**, put the Hyperdrive id in `apps/core/wrangler.jsonc` (replace the sample id with yours — it is not a secret, but it is account-specific)
4. Configure `apps/core/.env` secrets (`SESSION_SECRET`, `OIDC_SIGNING_JWK`) and `WEB_ORIGIN` in `apps/core/wrangler.jsonc` to your final **gate hostname** URL (e.g. `https://mail.example.com`)
5. `npm run deploy` (migrates DB, deploys **core**, builds the web app, deploys **gate**)
6. Attach the **gate hostname** to `flaremail-gate` in Cloudflare
7. For each mail **Domain**: enable Email Routing catch-all → Worker **`flaremail-core`**, plus Email Sending DNS

Subsequent deploys: `npm run deploy` (and `npm install` if the lockfile changed).

There is **no root `.env`**. Secrets and `DATABASE_URL` live in `apps/core/.env` only. `DATABASE_URL` is never uploaded to Cloudflare — production uses Hyperdrive.

### 1. Clone and install

```bash
git clone <repo-url> flaremail
cd flaremail
npm install
npx wrangler login
```

### 2. Database and secrets

```bash
cp apps/core/.env.example apps/core/.env
# Edit DATABASE_URL, SESSION_SECRET, OIDC_SIGNING_JWK
```

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Direct Neon URL — migrations and local `core:dev` only |
| `SESSION_SECRET` | Session cookie signing (uploaded as a Worker secret on deploy) |
| `OIDC_SIGNING_JWK` | ES256 private JWK JSON for OIDC (ADR-0007) |

Generate an ES256 signing JWK:

```bash
node -e "const {generateKeyPairSync}=require('crypto');const {exportJWK}=require('jose');(async()=>{const {privateKey}=generateKeyPairSync('ec',{namedCurve:'P-256'});const jwk=await exportJWK(privateKey);jwk.kid='flaremail';jwk.alg='ES256';jwk.use='sig';console.log(JSON.stringify(jwk))})()"
```

Paste the one-line JSON into `OIDC_SIGNING_JWK` in `apps/core/.env`.

### 3. Hyperdrive

```bash
npx wrangler hyperdrive create flaremail-db \
  --connection-string="postgres://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
npx wrangler hyperdrive update <HYPERDRIVE_ID> --caching-disabled true
```

Put the returned id in `apps/core/wrangler.jsonc` under `hyperdrive`. Do **not** put connection strings in wrangler config.

### 4. Deploy

Set `WEB_ORIGIN` in `apps/core/wrangler.jsonc` to the public **gate hostname** URL you will attach (same origin as the SPA and `/api`).

```bash
npm run deploy
```

This runs migrations, deploys `flaremail-core` with a filtered secrets file (`secrets.required` only — never `DATABASE_URL`), builds `apps/web`, then deploys `flaremail-gate`. Core has `workers_dev` and Preview URLs disabled; Email Routing and the gate service binding reach it by Worker name.

R2: Wrangler can provision the bucket from `r2_buckets` in core wrangler config.

### 5. Gate hostname and Email Routing

1. In Cloudflare → Workers → `flaremail-gate` → add your **gate hostname** (custom domain).
2. For each mail **Domain**: Email Routing → catch-all → **Send to a Worker** → `flaremail-core`.
3. Configure Email Sending DNS for outbound.

Order matters: deploy Workers before pointing Email Routing at core; attach the **gate hostname** after gate exists.

### 6. Web app env (optional local UI)

```bash
cp apps/web/.env.example apps/web/.env
```

| Variable | Purpose |
|----------|---------|
| `API_URL` | `/api/v1` (same-origin via gate) |
| `API_PROXY_TARGET` | Where Vite proxies `/api` in `web:dev` — prefer your deployed **gate hostname** |

Production UI is served by gate from `apps/web/dist`; you do not host the SPA separately.

---

## Development

*For developers integrating with or extending Flaremail.*

### Recommended DX

Prefer `web:dev` against a **deployed** gate (set `API_PROXY_TARGET` to the **gate hostname**). Local email cannot be tested reliably.

### Full local Workers (optional)

```bash
npm run dev          # core:dev + gate:dev (concurrently)
# or separately:
npm run core:dev     # private core (bindings / email handler)
npm run gate:dev     # public edge on :8787 — proxies /api/* to core when connected
npm run web:dev      # Vite on :5173, proxies /api to API_PROXY_TARGET
```

Health via gate (when both Workers are running locally):

```bash
curl http://localhost:8787/api/v1/openapi.json
```

Simulate inbound email only works against a running core with Email Routing tooling; prefer a deployed stack for mail path testing.

### API reference

Human-readable: [`docs/API.md`](./docs/API.md)

Machine-readable:

- OpenAPI YAML: [`apps/core/openapi.yaml`](./apps/core/openapi.yaml)
- Live JSON: `GET /api/v1/openapi.json` (no auth)

All protected routes require either a signed-in web session or an API key:

```
Authorization: Bearer <api-key>
```

API key format:

- API keys: `fmu_...`

Create API keys from `/settings?tab=security`.

Errors use [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) Problem Details (`application/problem+json`).

### Regenerating API clients

After changing `openapi.yaml`:

```bash
npm run apigen        # core OpenAPI JSON + web typed client
# or:
npm run core:apigen
npm run web:apigen
```

### Tests

```bash
npm run core:test
npm run web:test
```

---

## Architecture

*For maintainers and contributors.*

### Stack

| Layer | Technology |
|-------|------------|
| Public edge | `flaremail-gate` — SPA assets + `/api/*` → core |
| Inbound mail | Cloudflare Email Routing → **core** `email()` handler |
| Outbound mail | Cloudflare Email Sending (`send_email` on core) |
| MIME parsing | [postal-mime](https://github.com/postalsys/postal-mime) |
| HTTP API | **core** `fetch` handler (private; via gate service binding) |
| Metadata | Neon Postgres via Drizzle ORM + Hyperdrive |
| Blob storage | Cloudflare R2 (raw `.eml`, attachment bytes) |
| Web UI | React, Vite, TanStack Query, TipTap (built into gate) |
| Scheduled jobs | Core cron (`*/2 * * * *`) — validation receive timeouts |

Packaging decision: [`docs/adr/0010-gate-and-private-core.md`](./docs/adr/0010-gate-and-private-core.md).

### Data flow

```
Browser → gate (SPA + /api/*) → service binding → core API

Inbound SMTP → Email Routing → core email()
  → resolve mailbox (exact | alias | catch_all)
  → alias: forward via CF or store on target mailbox
  → persist message (Postgres) + raw EML & attachments (R2)
  → sync thread_mailboxes (folder, read, starred, preview)

Outbound → POST /api/v1/messages/send (via gate)
  → build MIME → Email Sending → persist sent message + thread update
```

### Monorepo layout

```
apps/
  core/            Private Worker — email, HTTP API, cron, bindings
    src/
      controllers/   HTTP adapters
      services/      Read orchestration, cascade deletes
      lib/           Domain logic (threading, MIME, outbound, validation)
      db/            Drizzle schema + client
    drizzle/       SQL migrations
    openapi.yaml   API contract (source of truth)
  gate/            Public Worker — SPA assets + /api proxy to core
  web/             React SPA source (built into gate; not a Worker)
docs/
  adr/             Architecture decision records
  CONTEXT.md       Domain glossary and terminology
  API.md           Human-readable API reference
```

Core layering is documented in [`docs/adr/0001-worker-layering.md`](./docs/adr/0001-worker-layering.md). Domain readiness validation in [`docs/adr/0002-domain-readiness-validation.md`](./docs/adr/0002-domain-readiness-validation.md).

### Stored data (inbound)

Each inbound message is saved to `messages` with threading headers, routing metadata (`actualMailboxId`, `envelopeTo`, `matchedVia`), and a preview. Binary content lives in R2:

| R2 key pattern | Content |
|----------------|---------|
| `raw/<message-id>.eml` | Stripped raw message (headers + text/html; attachments externalized) |
| `attachments/<message-id>/<attachment-id>/<filename>` | Inbound attachment bytes |

Attachment metadata is in the `attachments` table. Visibility across mailboxes is tracked in `message_mailboxes`; per-mailbox UI state lives on `thread_mailboxes`.

### Domain language

Use the terms in [`docs/CONTEXT.md`](./docs/CONTEXT.md) when writing code or docs — **Domain**, **gate hostname**, **gate**, **core**, **Mailbox**, **Thread**, **Folder**, **Label**, **Draft**, **Command**, etc. The glossary there is canonical.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run deploy` | Migrate + deploy core, then build web + deploy gate |
| `npm run dev` | Local core + gate (concurrently) |
| `npm run core:dev` | Local core Worker |
| `npm run core:deploy` | Migrate + deploy core with filtered secrets |
| `npm run core:test` | Core tests (Vitest + Workers pool) |
| `npm run core:typegen` | Regenerate core binding types |
| `npm run core:apigen` | Regenerate OpenAPI JSON from YAML |
| `npm run gate:dev` | Local gate Worker |
| `npm run gate:deploy` | Build web + deploy gate |
| `npm run db:generate` | Generate SQL migrations from schema |
| `npm run db:migrate` | Apply migrations to Neon |
| `npm run db:push` | Push schema directly (dev only) |
| `npm run db:pull` | Pull schema from Neon |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run web:dev` | Web app Vite server (proxy to gate) |
| `npm run web:build` | Production web build |
| `npm run web:start` | Preview production build |
| `npm run web:test` | Web unit tests |
| `npm run web:apigen` | Regenerate typed API client |
| `npm run apigen` | core + web API codegen |
| `npm run typegen` | Regenerate core types |
