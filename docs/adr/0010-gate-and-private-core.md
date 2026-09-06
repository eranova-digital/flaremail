# ADR-0010: Gate and private core

## Status

Accepted

## Context

Flaremail needs a browser UI and a Worker that handles Email Routing, outbound send, Postgres/R2, and the HTTP API. Putting the SPA on the same Worker as mail couples deploy cadence. Exposing the API on a public host separate from the UI forces CORS and splits the cookie origin.

## Decision

- **gate** (`flaremail-gate`) is the only public HTTP Worker: static assets from `apps/web/dist`, SPA fallback, blanket `/api/*` proxy to core via service binding.
- **core** (`flaremail-core`) owns email, API, crons, and bindings. `workers_dev` and Preview URLs are off; Email Routing and gate reach it by Worker name / binding.
- Browser and `/api` share the **gate hostname** (same-origin sessions).

## Considered options

- **Public core HTTP + separate UI host** — rejected; CORS and dual-origin cookies.
- **SPA assets on core** — rejected; independent deploy cadence for email/API vs UI.

## Consequences

- Deploy order: core, then gate (`npx flaremail deploy` does this).
- The CLI attaches the **gate hostname** to gate and Email Routing catch-all to core. Operators do not do this in the dashboard. See [`apps/cli/README.md`](../../apps/cli/README.md).
- Gate stays thin — no auth or business logic at the edge.
