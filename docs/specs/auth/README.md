# Authentication specs

Design specs for accounts, sessions, API keys, RBAC, OIDC IdP, and related UI. Implemented in **core** (HTTP) and **web** (UI). These docs are the narrative source for auth behaviour; OpenAPI and code are the runtime contract.

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

| Spec | File |
|------|------|
| Accounts & schema | [1-accounts-schema.md](./1-accounts-schema.md) |
| First-party auth | [2-first-party-auth.md](./2-first-party-auth.md) |
| API keys | [3-api-keys.md](./3-api-keys.md) |
| RBAC middleware | [4-rbac-middleware.md](./4-rbac-middleware.md) |
| OIDC IdP | [5-oidc-idp.md](./5-oidc-idp.md) |
| Web auth UI | [6-web-auth-ui.md](./6-web-auth-ui.md) |
| Admin UI | [7-admin-ui.md](./7-admin-ui.md) |

## Related ADRs

- [ADR-0003](../../adr/0003-oidc-subject-is-account-id.md) — OIDC `sub` is account ID
- [ADR-0004](../../adr/0004-first-party-session-vs-oidc-idp.md) — Session vs OIDC IdP
- [ADR-0005](../../adr/0005-intendant-break-glass-account.md) — Intendant bootstrap
- [ADR-0006](../../adr/0006-system-mailbox-access-by-role.md) — System mailbox access by role
- [ADR-0007](../../adr/0007-oidc-token-signing-es256.md) — ES256 token signing
- [ADR-0008](../../adr/0008-pkce-required-all-clients.md) — PKCE required

## Testing seam

Core tests share one auth seam: HTTP request → **principal resolution** (session, API key, OIDC user token, or client credentials) → **authorization** (role + assignments) → route handler. Prefer exercising this at the HTTP boundary (Vitest + Workers pool).
