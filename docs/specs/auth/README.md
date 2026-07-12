# Authentication specs

Specs for the auth & authorization feature on branch `feat/authentication`.

## Dependency order

```
1-accounts-schema
    ↓
2-first-party-auth ──┬── 3-api-keys
    ↓                ↓
4-rbac-middleware ←──┘
    ↓
5-oidc-idp
    ↓
6-web-auth-ui ── 7-admin-ui
```

## ADRs

- [ADR-0003](../adr/0003-oidc-subject-is-account-id.md) — OIDC `sub` is account ID
- [ADR-0004](../adr/0004-first-party-session-vs-oidc-idp.md) — Session vs OIDC IdP
- [ADR-0005](../adr/0005-intendant-break-glass-account.md) — Intendant bootstrap

## Testing seam

All worker specs share one auth seam: HTTP request → **principal resolution** (session, API key, OIDC user token, or client credentials) → **authorization** (role + assignments) → route handler. Tests exercise this at the HTTP boundary where possible (Vitest + Workers pool), matching existing route and lib test patterns.
