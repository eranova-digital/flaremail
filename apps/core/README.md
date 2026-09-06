# `@flaremail/core` — flaremail-core

Private Cloudflare Worker that owns mail, the HTTP API, crons, and platform bindings. Browsers never call core directly in production; **gate** reaches it over a service binding. Email Routing targets this Worker by name (`flaremail-core`).

Package: `apps/core` · CF name: `flaremail-core` · `workers_dev` / Preview URLs: **off**

---

## Responsibilities

| Surface | Role |
|---------|------|
| `email()` | Inbound mail from Email Routing |
| `fetch()` | Versioned HTTP API (`/api/v1`, `/health`, …) |
| `scheduled()` | Domain-validation timeouts, log retention |
| Bindings | Hyperdrive (Postgres), R2, `send_email`, rate limits |

Non-responsibilities: serving the SPA, public DNS for the web UI (that is [gate](../gate/README.md)).

---

## Architecture

Layering ([ADR-0001](../../docs/adr/0001-worker-layering.md)):

```
src/
  index.ts           Worker entry (email / fetch / scheduled)
  routes/            Route table → controllers
  controllers/       HTTP adapters (parse, call service, map response)
  services/          Use-case facades (auth, mailboxes, outbound-mail, …)
  lib/               Domain modules (MIME, threading, auth crypto, …)
  db/                Drizzle schema + client
```

**Controllers** stay thin. **Services** orchestrate. **lib/** holds reusable domain logic (e.g. `lib/thread-mailbox/`, `lib/messages/`).

### Inbound mail flow

```
Email Routing → email(message, env)
  → PostalMime parse
  → optional domain-validation consume
  → resolve mailbox (exact | alias | catch_all)
  → alias: forward or store on target
  → persist message (Postgres) + raw EML / attachments (R2)
  → sync thread_mailboxes
```

Unknown addresses / policy rejects are handled in the email handler (no HTTP).

### HTTP API flow

```
Request (usually via gate service binding)
  → routes → principal resolution (session | API key | OIDC)
  → authorization (role + assignments)
  → controller → service → lib / db
  → JSON or RFC 9457 Problem Details
```

OpenAPI source of truth: [`openapi.yaml`](./openapi.yaml). Human guide: [`docs/API.md`](../../docs/API.md).

### Outbound mail flow

```
POST /api/v1/... (send | reply | forward | draft send)
  → services/outbound-mail
  → build MIME → EMAIL binding
  → persist sent message + thread updates
```

### Data

| Store | Contents |
|-------|----------|
| Neon (via Hyperdrive) | Domains, accounts, mailboxes, threads, messages metadata, logs, OIDC, … |
| R2 (`BUCKET`) | `raw/<id>.eml`, attachment bytes, profile pictures, … |

Local `wrangler dev` (via `npx flaremail dev`) does not use real Hyperdrive. Generated `apps/core/.env` `DATABASE_URL` is mapped into Wrangler’s local Hyperdrive stub. Vitest must not write to Postgres.

---

## Configuration

Do not configure this Worker by hand. Use [`apps/cli`](../cli/README.md) (`flaremail.conf.jsonc`). Generated `wrangler.jsonc` and `.env` are gitignored.

Deploy with `npx flaremail deploy --core --yes` (or full `deploy`). Never put `DATABASE_URL` in Cloudflare secrets.

---

## Scripts (from repo root)

| Command | What |
|---------|------|
| `npx flaremail dev` | Local core + gate (materializes conf first) |
| `npx flaremail deploy --core --yes` | Migrate + deploy this Worker |
| `npm run core:test` | Vitest (Workers pool) |
| `npm run core:apigen` | YAML → `src/openapi/spec.json` |
| `npm run typegen` | `wrangler types` (after `flaremail sync`) |
| `npm run db:*` | Drizzle generate / migrate / studio / … |

---

## Related docs

- [CLI](../cli/README.md) — instance config and deploy
- [Root README](../../README.md)
- [Gate](../gate/README.md) — public proxy
- [CONTEXT](../../docs/CONTEXT.md) — domain language
- Auth specs: [`docs/specs/auth/`](../../docs/specs/auth/)
