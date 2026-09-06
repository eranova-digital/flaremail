# `@flaremail/gate` — flaremail-gate

Public Cloudflare Worker: serves the Flaremail SPA and proxies `/api/*` to private **core**. This is the only Worker browsers should hit.

Package: `apps/gate` · CF name: `flaremail-gate`

---

## Responsibilities

| Concern | Behavior |
|---------|----------|
| Static assets | Wrangler `assets.directory` → `../web/dist` |
| SPA routes | `not_found_handling: single-page-application` |
| API | `run_worker_first: ["/api/*", "/health"]` → `env.CORE.fetch(request)` — includes `/api/v1/oauth/*` |
| Everything else under `/api` miss | Worker returns 404 (assets/SPA handle non-API) |
| `/.well-known/*` | **Not** forwarded. OIDC discovery is on core only; RPs must use `/api/v1/oauth/*` URLs (see [`docs/API.md`](../../docs/API.md#oidc)). |

Non-responsibilities: business logic, auth decisions, mail, database. Gate is intentionally thin ([ADR-0010](../../docs/adr/0010-gate-and-private-core.md)).

---

## Architecture

```
Incoming request
  │
  ├─ path matches /api/* or /health  →  Worker script  →  CORE service binding  →  flaremail-core
  │
  └─ otherwise            →  static asset or SPA index.html fallback
```

`src/index.ts` only handles the `/api/*` and `/health` branches. Asset routing is in the **generated** Wrangler config (from the CLI), not in application code.

### Service binding

```jsonc
"services": [{ "binding": "CORE", "service": "flaremail-core" }]
```

- Deploy **core before gate** so the binding target exists (`npx flaremail deploy` does this).
- Locally, `npx flaremail dev` runs both so Wrangler marks the binding `connected`.
- Forward the incoming `Request` as-is (method, path, query, headers, body, cookies). No path rewrite, no auth on gate.

### Same-origin model

Browser origin = **gate hostname**. SPA uses `API_URL=/api/v1`. Session cookies (`SameSite=Lax`, `credentials: include`) stay first-party. Core’s `WEB_ORIGIN` must match that hostname URL.

---

## Build and deploy

Do not deploy gate with Wrangler by hand. The CLI builds `apps/web` and deploys gate:

```bash
npx flaremail deploy --yes          # core then gate
npx flaremail deploy --gate --yes   # web build + gate only
```

See [`apps/cli`](../cli/README.md). Gate typically has **no** Worker secrets. The **gate hostname** custom domain comes from conf.

---

## Scripts

| Command | What |
|---------|------|
| `npx flaremail dev` | Local core + gate |
| `npx flaremail deploy --gate --yes` | Build web + deploy this Worker |
| `npm run typegen -w @flaremail/gate` | Regenerate `worker-configuration.d.ts` (after `flaremail sync`) |

---

## Related docs

- [CLI](../cli/README.md) — instance config and deploy
- [Root README](../../README.md)
- [Core](../core/README.md) — API and mail
- [Web](../web/README.md) — SPA source
- [ADR-0010](../../docs/adr/0010-gate-and-private-core.md)
