# `@flaremail/gate` — flaremail-gate

Public Cloudflare Worker: serves the Flaremail SPA and proxies `/api/*` to private **core**. This is the only Worker browsers should hit.

Package: `apps/gate` · CF name: `flaremail-gate`

---

## Responsibilities

| Concern | Behavior |
|---------|----------|
| Static assets | Wrangler `assets.directory` → `../web/dist` |
| SPA routes | `not_found_handling: single-page-application` |
| API | `run_worker_first: ["/api/*", "/health"]` → `env.CORE.fetch(request)` |
| Everything else under `/api` miss | Worker returns 404 (assets/SPA handle non-API) |

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

`src/index.ts` only handles the `/api/*` and `/health` branches. Asset routing is configured in `wrangler.jsonc`, not in application code.

### Service binding

```jsonc
"services": [{ "binding": "CORE", "service": "flaremail-core" }]
```

- Deploy **core before gate** so the binding target exists.
- Locally, run `gate:dev` and `core:dev` together (`npm run dev` from the repo root) so Wrangler marks the binding `connected`.
- Forward the incoming `Request` as-is (method, path, query, headers, body, cookies). No path rewrite, no auth on gate.

### Same-origin model

Browser origin = **gate hostname**. SPA uses `API_URL=/api/v1`. Session cookies (`SameSite=Lax`, `credentials: include`) stay first-party. Core’s `WEB_ORIGIN` must match that hostname URL.

---

## Build and deploy

Gate does not build the UI itself; root `gate:deploy` does:

```bash
npm run web:build          # apps/web → apps/web/dist
npm run deploy -w @flaremail/gate
```

Or from the monorepo root: `npm run gate:deploy` / `npm run deploy`.

Assets must exist at `apps/web/dist` before `wrangler deploy` for gate. Empty or stale `dist` ships a broken UI.

Gate typically has **no** Worker secrets.

---

## Scripts

| Command | What |
|---------|------|
| `npm run gate:dev` | `wrangler dev` for this Worker |
| `npm run gate:deploy` | Build web + deploy gate |
| `npm run typegen -w @flaremail/gate` | Regenerate `worker-configuration.d.ts` |

---

## Related docs

- [Root README](../../README.md)
- [Core](../core/README.md) — API and mail
- [Web](../web/README.md) — SPA source
- [ADR-0010](../../docs/adr/0010-gate-and-private-core.md)
