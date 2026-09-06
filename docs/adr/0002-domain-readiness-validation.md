# ADR-0002: Advisory domain readiness validation

## Status

Accepted

## Context

Operators add **domains** before Cloudflare Email Routing DNS is fully provisioned. CF generates MX/SPF/DKIM values and does not expose expected record values via API, so we cannot verify correctness — only existence and end-to-end mail flow.

## Decision

- Introduce **domain readiness**: advisory diagnostics separate from **routing** (`matchedVia`) and from `isActive`.
- Run checks in **domain validation runs** with history, per-check results, and structured log events.
- **Critical** checks (badge `fail`): MX exists, loop send `noreply@` → `postmaster@`, loop receive at `postmaster@`.
- **Advisory** checks (badge `unhealthy` when critical pass): DMARC `rua` contains `mailto:postmaster@<domain>`.
- Derived badge: `checking` | `fail` | `healthy` | `unhealthy`.
- One active run per domain; short-circuit remaining checks on critical failure.
- Loop emails carry a per-run token in body (primary) and `X-Flaremail-Validation-Token` header; inbound handler **consumes** them (not stored as mailbox messages). CF Email Sending does not allow custom `Message-ID`.
- Receive wait: 10-minute deadline; Worker **scheduled** cron (`*/2 * * * *`) processes timeouts. UI polls while `checking`.
- Validation never blocks mail or mutates `isActive`.

## Considered options

- **Single opaque status** — rejected; operators need to know whether DNS, send, or receive failed.
- **Block domain on `fail`** — rejected; validation is diagnostic only.
- **Best-effort loop after MX failure** — rejected; short-circuit saves send quota and simplifies UX.
- **`waitUntil` for receive wait** — rejected; HTTP `waitUntil` is capped; use DB state + cron.

## Consequences

- New tables: validation runs, checks, log events.
- `index.ts` gains `scheduled()` handler; cron lives in the CLI Wrangler template (generated `wrangler.jsonc`, see [ADR-0012](./0012-cli-instance-config.md)).
- Inbound email path checks for validation tokens before normal persistence.
- Settings UI shows badge, recheck, and expandable run detail.
