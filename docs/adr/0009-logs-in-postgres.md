# ADR-0009: Logs stored in Postgres

## Status

Accepted

## Context

**Logs** need filterable list queries (text, datetime range, **importance**, **type**), joins/resolution of **refs** for rich UI, and retention purge driven by instance **log retention**. Alternatives like R2 object streams or Cloudflare Analytics Engine favor append/analytics over relational filter + entity resolution.

## Decision

Persist **logs** in the same Postgres database as the rest of the app. Purge expired rows via the existing Worker cron using **log retention**.

## Consequences

- List/filter and **ref** hydration stay in one query path with the rest of the platform.
- High-volume **importance** 10 traffic grows the primary DB; mitigate with **max importance stored**, **logs enabled**, and retention (3–90 days), not a separate store in v1.
