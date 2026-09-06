# `@flaremail/web`

React SPA for Flaremail. **Source only** — not a Cloudflare Worker. Production builds are uploaded as static assets on **gate** (`apps/web/dist` → `flaremail-gate`).

Package: `apps/web`

---

## Responsibilities

- Sign-in, bootstrap, activate, password reset, OIDC consent, security compliance
- Mail UI: folders, threads, compose (TipTap), labels, search
- Settings and management (domains, mailboxes, accounts, identities, OIDC clients, …)
- Typed API client generated from core’s OpenAPI

Non-responsibilities: hosting in production (gate), mail delivery (core), API authorization logic (core).

---

## Architecture

```
src/
  main.tsx           BrowserRouter + AuthProvider
  App.tsx            Route table
  components/        UI (mail, settings, management, …)
  lib/
    api/             Generated OpenAPI client + helpers
    auth/            Session / credentials helpers
    i18n/            Locale wiring (@flaremail/i18n)
    …                Domain-specific client logic
```

### Routing (high level)

| Area | Examples |
|------|----------|
| Public | `/login`, `/bootstrap`, `/activate`, `/reset-password` |
| OAuth / security | `/oauth/consent`, `/security-compliance` |
| App shell | `/`, `/settings`, `/management` |
| Mailbox | `/m/:mailboxId/...` (compose, threads, folders, labels) |

Auth gates in the router enforce session and security-compliance before mail routes.

### Talking to the API

```
Browser → same origin /api/v1/... → gate → core
```

| Env var | Role |
|---------|------|
| `API_URL` | Base path for the client — production/default: `/api/v1` |
| `API_PROXY_TARGET` | Dev only: where Vite proxies `/api` (`web:dev`) |

`vite.config.ts` proxies `/api` → `API_PROXY_TARGET`. Prefer pointing that at a **deployed gate hostname**. For local gate+core, use `http://localhost:8787`.

Credentials: session cookies with `credentials: "include"`; same-origin via gate avoids CORS.

### Data / UI patterns

- **TanStack Query** for server state
- **TipTap** for rich compose and signatures
- **i18n** via `@flaremail/i18n` + react-i18next
- Shared packages: identity name patterns, local-part policy, mail quoting, email HTML prepare, API error types

---

## Local development

```bash
npx flaremail sync
# API_PROXY_TARGET comes from conf (gate hostname)
npm run web:dev
```

Open `http://localhost:5173`. API calls go through the Vite proxy to the gate (or local Workers).

```bash
npm run web:build    # tsc + vite → dist/ (consumed by gate deploy)
npm run web:test     # Vitest
npm run web:apigen   # OpenAPI → src/lib/api/generated/
```

After changing `apps/core/openapi.yaml`, run `npm run apigen` from the repo root (core JSON + this client).

---

## Production

Do not deploy this package as its own Worker. `npm run gate:deploy` / `npm run deploy` builds this app and publishes `dist/` with gate.

---

## Related docs

- [Root README](../../README.md)
- [Gate](../gate/README.md) — how assets and `/api` are served
- [Core](../core/README.md) — API behavior
- [docs/API.md](../../docs/API.md)
- Auth UI specs: [`docs/specs/auth/6-web-auth-ui.md`](../../docs/specs/auth/6-web-auth-ui.md), [`7-admin-ui.md`](../../docs/specs/auth/7-admin-ui.md)
