# ADR-0011: BIMI inbound brand marks

## Status

Accepted

## Context

Inbound senders may publish BIMI logos. Cloudflare Email Routing does not reliably stamp Authentication-Results, so showing a brand mark without our own auth checks would display unverified logos.

## Decision

Inbound BIMI logos are shown only after **core** verifies DKIM/SPF/DMARC itself, the message DMARC-passes with alignment, and the **organizational domain** publishes an enforcing policy (`quarantine`/`reject`). Accept self-asserted BIMI (no VMC). Rasterize the SVG to WebP in R2, cache per publishing domain with TTL (including negative cache), resolve BIMI asynchronously after store, and serve logos only to authenticated sessions — not as public unauthenticated URLs.

## Consequences

- Sender avatars in the mail UI may show a **BIMI logo** distinct from **account** / **client profile pictures**.
- Logo bytes are auth-gated (`GET /api/v1/bimi/:domain/logo`).
