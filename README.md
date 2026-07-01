# Email Catch-All Worker

Cloudflare Worker that receives inbound email from catch-all routing rules on multiple domains, parses the message, and stores it in Neon Postgres via Drizzle ORM and Hyperdrive.

## Stack

- Cloudflare Email Routing → Worker `email()` handler
- [postal-mime](https://github.com/postalsys/postal-mime) for MIME parsing
- Drizzle ORM + `pg` driver
- Hyperdrive → Neon Postgres

## Setup

### 1. Local environment (`apps/worker/.env`)

Copy `apps/worker/.env.example` to `apps/worker/.env` and set:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | **Local only.** Direct Neon Postgres URL (not a Hyperdrive URL) |
| `API_BEARER_TOKEN` | Bearer token for `Authorization` on `/api/v1/*` routes |

```bash
cp apps/worker/.env.example apps/worker/.env
```

Use `.env` only (not `.dev.vars`) for local secrets ([docs](https://developers.cloudflare.com/workers/configuration/secrets/)).

#### How the database is reached

| Environment | Connection path |
|-------------|-----------------|
| **Deployed Worker** | `env.HYPERDRIVE.connectionString` → Cloudflare Hyperdrive → Neon |
| **Local dev / tests** | `env.HYPERDRIVE.connectionString` → direct Neon (`DATABASE_URL`) |

Hyperdrive does not run during `wrangler dev`. Wrangler still exposes the `HYPERDRIVE` binding, but you must tell it which **direct** Postgres URL to use via `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` ([docs](https://developers.cloudflare.com/hyperdrive/configuration/local-development/)).

`npm run worker:dev` and Vitest call `scripts/sync-local-db-env.mjs`, which sets that variable from `DATABASE_URL`. You only maintain the direct Neon URL in `.env` — do **not** add a separate Hyperdrive connection string for local use.

**Production:** `DATABASE_URL` is not deployed. Set the API secret with:

```bash
npx wrangler secret put API_BEARER_TOKEN
```

`API_BEARER_TOKEN` is listed under `secrets.required` in `wrangler.jsonc`.

### 2. Web app environment (`apps/web/.env`)

Copy `apps/web/.env.example` to `apps/web/.env` and set:

| Variable | Purpose |
|----------|---------|
| `API_URL` | Base URL for the Worker API |

```bash
cp apps/web/.env.example apps/web/.env
```

Use a full URL (`http://localhost:8787` for local `worker:dev`) or a hostname (`test-worker.example.workers.dev` — `https://` is added automatically). Access it in code via `getApiUrl()` / `apiUrl()` from `src/lib/api.ts`, or directly as `import.meta.env.API_URL`.

Vite exposes `API_URL` to the client through `envPrefix` in `apps/web/vite.config.ts` (alongside the usual `VITE_*` variables).

### 3. Neon database

Create a Neon project and use the **direct** Postgres connection string (not the serverless HTTP one) as `DATABASE_URL`.

Run migrations:

```bash
npm run db:migrate
```

### 4. Hyperdrive

Create a Hyperdrive config pointing at Neon:

```bash
npx wrangler hyperdrive create email-catchall-db \
  --connection-string="postgres://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

Copy the returned Hyperdrive ID into `wrangler.jsonc`:

```jsonc
"hyperdrive": [
  {
    "binding": "HYPERDRIVE",
    "id": "<YOUR_HYPERDRIVE_ID>",
  }
]
```

Do **not** put any connection string in `wrangler.jsonc`. Local dev uses the direct Neon `DATABASE_URL` from `.env` (see above). The Hyperdrive config ID is only used once the Worker is deployed.

**Disable Hyperdrive query caching** for this API. Hyperdrive caches read-only `SELECT` results for up to 60 seconds by default and does not invalidate the cache when you write (e.g. starring a thread). That makes list/get endpoints appear stale even though Neon already has the updated row.

```bash
npx wrangler hyperdrive update <YOUR_HYPERDRIVE_ID> --caching-disabled true
```

### 5. Deploy the Worker

```bash
npm run worker:deploy
```

#### `API_BEARER_TOKEN` already in use (error 10053)

**Secrets Store** (account-level) is not the same as **Worker variables**. This error means `API_BEARER_TOKEN` already exists on the Worker as a **plain text environment variable**, so `wrangler secret put` cannot reuse the name.

Check the deployed binding:

```bash
npx wrangler versions list
npx wrangler versions view <latest-version-id>
```

If you see `env.API_BEARER_TOKEN (...) Environment Variable`, fix it in the dashboard:

1. [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) → **test-worker** → **Settings**
2. **Variables and Secrets** → **Edit**
3. Remove `API_BEARER_TOKEN`, or change its type to **Secret** (encrypt) and set a new value
4. **Deploy** the settings change

Then (if you removed it):

```bash
npx wrangler secret put API_BEARER_TOKEN
```

If the token was previously stored as plain text, rotate it when moving to a secret.

### 6. Route catch-all email to the Worker

For each domain in Cloudflare:

1. Enable **Email Routing** on the domain.
2. Add an **Email Routing rule**:
   - Match: **Catch-all address** (or specific addresses)
   - Action: **Send to a Worker**
   - Worker: `test-worker`

Repeat for every domain whose catch-all mail should land in this database.

## Local development

Start the dev server:

```bash
npm run worker:dev
```

Send a test email to the local email handler:

```bash
curl --request POST 'http://localhost:8787/cdn-cgi/handler/email' \
  --url-query 'from=sender@example.com' \
  --url-query 'to=anything@yourdomain.com' \
  --data-raw $'From: sender@example.com\r\nTo: anything@yourdomain.com\r\nSubject: Test\r\nMessage-ID: <test-local-1@example.com>\r\nDate: Tue, 30 Jun 2026 12:00:00 +0000\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHello from local dev'
```

Health check:

```bash
curl http://localhost:8787/health
```

## Stored fields

Each inbound message is saved to the `messages` table:

| Column | Description |
|--------|-------------|
| `id` | UUID primary key |
| `thread_id` | UUID grouping messages into a thread |
| `message_id` | Message-ID header (unique, required) |
| `in_reply_to` | In-Reply-To header (FK to `message_id`) |
| `references` | References header as `text[]` |
| `from` | Sender address |
| `to` | Recipient addresses |
| `cc` | CC addresses |
| `bcc` | BCC addresses |
| `subject` | Subject header |
| `text_body` | Plain-text body |
| `preview` | First 200 characters of `text_body` |
| `has_html` | Whether the message included an HTML body |
| `has_attachments` | Whether attachment parts were extracted and stored separately |
| `sent_at` | Date header from the message |
| `received_at` | Timestamp when the worker stored the message |
| `raw_eml_key` | R2 object key for the stripped `.eml` file (`raw/<id>.eml`) |

Attachment metadata lives in the `attachments` table. Binary content is stored at `attachments/<message_id>/<attachment_id>/<filename>` in R2. The raw `.eml` object keeps headers and text/html bodies only; each extracted attachment is referenced with an `X-Attachment-External` header pointing at its R2 key.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run worker:dev` | Local Worker + email handler |
| `npm run worker:deploy` | Deploy to Cloudflare |
| `npm run worker:test` | Run Worker tests |
| `npm run worker:typegen` | Regenerate Worker binding types |
| `npm run worker:cf-typegen` | Regenerate Worker binding types (alias) |
| `npm run worker:apigen` | Regenerate OpenAPI JSON from `openapi.yaml` |
| `npm run db:generate` | Generate SQL migrations from schema |
| `npm run db:migrate` | Apply migrations to Neon |
| `npm run db:push` | Push schema directly to Neon |
| `npm run db:pull` | Pull schema from Neon |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run web:dev` | Web app dev server |
| `npm run web:build` | Production web build |
| `npm run web:start` | Serve production web build |
