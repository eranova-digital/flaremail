# Flaremail

Self-hosted email for your domains — receive catch-all mail, read and send from shared mailboxes, and manage everything through a web UI or HTTP API.

Built on Cloudflare (Email Routing, Email Sending, Workers, R2) with Postgres (Neon) for metadata.

---

## What Flaremail does

1. **Receives** inbound mail via Cloudflare Email Routing and stores messages in Postgres + R2.
2. **Routes** each message to the right mailbox — exact address, alias, or domain catch-all.
3. **Exposes** a versioned REST API for domains, mailboxes, threads, drafts, send/reply/forward, search, and labels.
4. **Provides** a React web app for day-to-day mail operations.

Inbound mail never hits HTTP; Cloudflare invokes the Worker's `email()` handler directly. Everything else goes through `/api/v1`.

---

## Using the web app

*For operators and anyone reading mail day to day.*

### Getting started

1. Open the web app (your deployment URL or `http://localhost:5173` in local dev).
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

*For admins deploying their own instance.*

### Prerequisites

| Service | Purpose |
|---------|---------|
| [Cloudflare](https://dash.cloudflare.com) account | Workers, Email Routing, Email Sending, R2, Hyperdrive |
| [Neon](https://neon.tech) Postgres | Message metadata, threads, domains |
| Node.js 20+ | Build and local development |

### 1. Clone and install

```bash
git clone <repo-url> flaremail
cd flaremail
npm install
```

### 2. Database

Create a Neon project. Use the **direct** Postgres connection string (not the serverless HTTP endpoint).

```bash
cp apps/worker/.env.example apps/worker/.env
# Edit DATABASE_URL
npm run db:migrate
```

### 3. Worker secrets and bindings

In `apps/worker/.env`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Direct Neon URL — local dev and migrations only |
| `SESSION_SECRET` | Session cookie signing secret |
| `OIDC_SIGNING_JWK` | ES256 private JWK JSON for OIDC access/ID tokens (ADR-0007) |

**Deployed Workers** use Hyperdrive (configured in `apps/worker/wrangler.jsonc`), not `DATABASE_URL`. Set secrets in production:

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put OIDC_SIGNING_JWK
```

Generate an ES256 signing JWK (local or CI):

```bash
node -e "const {generateKeyPairSync}=require('crypto');const {exportJWK}=require('jose');(async()=>{const {privateKey}=generateKeyPairSync('ec',{namedCurve:'P-256'});const jwk=await exportJWK(privateKey);jwk.kid='flaremail';jwk.alg='ES256';jwk.use='sig';console.log(JSON.stringify(jwk))})()"
```

Paste the JSON into `OIDC_SIGNING_JWK` (`.dev.vars` locally, or pipe into `wrangler secret put OIDC_SIGNING_JWK`).

#### Hyperdrive

Create a Hyperdrive config pointing at Neon:

```bash
npx wrangler hyperdrive create flaremail-db \
  --connection-string="postgres://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

Put the returned ID in `wrangler.jsonc` under `hyperdrive`. Do **not** put connection strings in `wrangler.jsonc`.

**Disable query caching** — Hyperdrive caches read-only `SELECT` results by default, which makes list/get endpoints look stale after writes:

```bash
npx wrangler hyperdrive update <HYPERDRIVE_ID> --caching-disabled true
```

#### Local database access

Hyperdrive does not run during `wrangler dev`. Wrangler still exposes the `HYPERDRIVE` binding, but routes it to your direct Neon URL via `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`. `npm run worker:dev` and tests run `scripts/sync-local-db-env.mjs`, which sets that from `DATABASE_URL`. Maintain only the direct URL in `.env`.

### 4. R2 and Email Sending

`wrangler.jsonc` binds an R2 bucket (`BUCKET`) for raw `.eml` files and attachment bytes, and an `EMAIL` binding for outbound send via Cloudflare Email Sending. Create the R2 bucket name to match your config before deploying.

### 5. Deploy the Worker

```bash
npm run worker:deploy
```

The Worker name defaults to `test-worker` in `wrangler.jsonc` — change `"name"` before deploying if you prefer a different hostname.

#### `API_BEARER_TOKEN` already in use (error 10053)

This means the token exists as a **plain environment variable** on the Worker, blocking `wrangler secret put`. In the Cloudflare dashboard → your Worker → **Settings → Variables and Secrets**, remove `API_BEARER_TOKEN` or convert it to an encrypted secret, redeploy, then:

```bash
npx wrangler secret put API_BEARER_TOKEN
```

Rotate the token if it was previously stored as plain text.

### 6. Route inbound mail

For each domain in Cloudflare:

1. Enable **Email Routing**.
2. Add a rule: **Catch-all address** (or specific addresses) → **Send to a Worker** → your deployed Worker.
3. In Flaremail **Settings**, add the domain and configure catch-all if desired (`catchAllEnabled` + `catchAllMailboxId`).

Repeat for every domain whose mail should land in this database.

### 7. Web app

```bash
cp apps/web/.env.example apps/web/.env
```

| Variable | Purpose |
|----------|---------|
| `API_URL` | API base path — `/api/v1` for same-origin proxy (recommended locally) |
| `API_PROXY_TARGET` | Where Vite proxies `/api` in dev (`http://localhost:8787`) |
| `API_BEARER_TOKEN` | Must match the Worker's `API_BEARER_TOKEN` |

```bash
npm run web:dev    # http://localhost:5173
npm run web:build  # production static build
```

For production, serve the built `apps/web/dist` behind any static host and point `/api` at your Worker (or set `API_URL` to the Worker's full `/api/v1` URL).

---

## Development

*For developers integrating with or extending Flaremail.*

### Local stack

Terminal 1 — Worker (API + email handler on port 8787):

```bash
npm run worker:dev
```

Terminal 2 — Web app (port 5173, proxies `/api` to the Worker):

```bash
npm run web:dev
```

Health check:

```bash
curl http://localhost:8787/health
```

Simulate inbound email locally:

```bash
curl --request POST 'http://localhost:8787/cdn-cgi/handler/email' \
  --url-query 'from=sender@example.com' \
  --url-query 'to=anything@yourdomain.com' \
  --data-raw $'From: sender@example.com\r\nTo: anything@yourdomain.com\r\nSubject: Test\r\nMessage-ID: <test-local-1@example.com>\r\nDate: Tue, 30 Jun 2026 12:00:00 +0000\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHello from local dev'
```

### API reference

Human-readable: [`api.md`](./api.md)

Machine-readable:

- OpenAPI YAML: [`apps/worker/openapi.yaml`](./apps/worker/openapi.yaml)
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
npm run worker:apigen   # YAML → apps/worker/src/openapi/spec.json
npm run web:apigen      # OpenAPI → apps/web/src/lib/api/generated/
```

### Tests

```bash
npm run worker:test
npm run web:test
```

---

## Architecture

*For maintainers and contributors.*

### Stack

| Layer | Technology |
|-------|------------|
| Inbound mail | Cloudflare Email Routing → Worker `email()` handler |
| Outbound mail | Cloudflare Email Sending (`send_email` binding) |
| MIME parsing | [postal-mime](https://github.com/postalsys/postal-mime) |
| HTTP API | Cloudflare Worker `fetch` handler |
| Metadata | Neon Postgres via Drizzle ORM + Hyperdrive |
| Blob storage | Cloudflare R2 (raw `.eml`, attachment bytes) |
| Web UI | React, Vite, TanStack Query, TipTap |
| Scheduled jobs | Worker cron (`*/2 * * * *`) — validation receive timeouts |

### Data flow

```
Inbound SMTP → Email Routing → Worker email()
  → resolve mailbox (exact | alias | catch_all)
  → alias: forward via CF or store on target mailbox
  → persist message (Postgres) + raw EML & attachments (R2)
  → sync thread_mailboxes (folder, read, starred, preview)

Outbound → POST /api/v1/messages/send (or reply/forward/draft send)
  → build MIME → Email Sending → persist sent message + thread update
```

### Monorepo layout

```
apps/
  worker/          Cloudflare Worker — email handler, HTTP API, cron
    src/
      controllers/   HTTP adapters
      services/      Read orchestration, cascade deletes
      lib/           Domain logic (threading, MIME, outbound, validation)
      db/            Drizzle schema + client
    drizzle/       SQL migrations
    openapi.yaml   API contract (source of truth)
  web/             React SPA
docs/
  adr/             Architecture decision records
CONTEXT.md         Domain glossary and terminology
api.md             Human-readable API reference
```

Worker layering is documented in [`docs/adr/0001-worker-layering.md`](./docs/adr/0001-worker-layering.md). Domain readiness validation in [`docs/adr/0002-domain-readiness-validation.md`](./docs/adr/0002-domain-readiness-validation.md).

### Stored data (inbound)

Each inbound message is saved to `messages` with threading headers, routing metadata (`actualMailboxId`, `envelopeTo`, `matchedVia`), and a preview. Binary content lives in R2:

| R2 key pattern | Content |
|----------------|---------|
| `raw/<message-id>.eml` | Stripped raw message (headers + text/html; attachments externalized) |
| `attachments/<message-id>/<attachment-id>/<filename>` | Inbound attachment bytes |

Attachment metadata is in the `attachments` table. Visibility across mailboxes is tracked in `message_mailboxes`; per-mailbox UI state lives on `thread_mailboxes`.

### Domain language

Use the terms in [`CONTEXT.md`](./CONTEXT.md) when writing code or docs — **Domain**, **Mailbox**, **Thread**, **Folder**, **Label**, **Draft**, **Command**, etc. The glossary there is canonical.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run worker:dev` | Local Worker + email handler |
| `npm run worker:deploy` | Deploy Worker to Cloudflare |
| `npm run worker:test` | Worker tests (Vitest + Workers pool) |
| `npm run worker:typegen` | Regenerate Worker binding types |
| `npm run worker:apigen` | Regenerate OpenAPI JSON from YAML |
| `npm run db:generate` | Generate SQL migrations from schema |
| `npm run db:migrate` | Apply migrations to Neon |
| `npm run db:push` | Push schema directly (dev only) |
| `npm run db:pull` | Pull schema from Neon |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run web:dev` | Web app dev server |
| `npm run web:build` | Production web build |
| `npm run web:start` | Preview production build |
| `npm run web:test` | Web unit tests |
| `npm run web:apigen` | Regenerate typed API client |
