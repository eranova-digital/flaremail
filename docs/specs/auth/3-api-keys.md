# Spec: API keys

## Problem Statement

**Accounts** need programmatic API access without embedding web **session** cookies. V1's shared `API_BEARER_TOKEN` grants full platform access and cannot represent individual **operators** or their **roles**.

## Solution

Allow any **account** to create, list, and revoke **API keys**. Keys authenticate as the holder with exactly their **role** and assignment permissions. Replace static bearer token for normal operations.

## User Stories

1. As a **user**, I want to create an **API key**, so that I can script mail operations against my **mailboxes**.
2. As an **admin**, I want my **API key** to carry admin powers within my **domain assignments**, so that automation respects my scope.
3. As an **intendant**, I want to create **API keys** for platform management, so that I can automate domain and account operations.
4. As a **user**, I want to label/name my keys, so that I can identify them later.
5. As a **user**, I want to revoke an **API key**, so that a compromised key stops working immediately.
6. As a **user**, I want to list my active keys (without seeing full secret after creation), so that I can audit what exists.
7. As a **user**, I want the full key secret shown only once at creation, so that storage follows best practice.
8. As a platform, I want revoked keys to return 401, so that authorization fails closed.
9. As a **suspended account** holder, I want my keys to stop working, so that suspension is comprehensive.
10. As a **user**, I want API keys to access the same mail API endpoints as my session, so that behavior is consistent.
11. As a deployer, I want to deprecate `API_BEARER_TOKEN` after migration, so that shared secrets are eliminated.

## Implementation Decisions

- **API key** table: id, account_id, name, key_prefix (for identification), key_hash, created_at, last_used_at, revoked_at.
- Authorization header: `Bearer fm_<random>` or similar prefix to distinguish from OIDC JWTs.
- Key creation endpoint: authenticated via session; returns secret once.
- Principal resolution: API key → account → role + assignments (same shape as session principal).
- Keys inherit full permission model; no narrower scopes in V1 (scope narrowing is out of scope).
- Migration path: keep `API_BEARER_TOKEN` temporarily behind feature flag or remove after web app uses sessions.

## Testing Decisions

- Create key → use key on authenticated endpoint → success.
- Revoked key → 401.
- Suspended account key → 401.
- User key cannot perform admin-only action → 403.
- Prior art: auth middleware integration tests at HTTP boundary.

## Out of Scope

- Per-key permission narrowing (inherits account only).
- OIDC client credentials (separate mechanism).
- Key rotation automation.

## Further Notes

- Depends on: Accounts & schema, first-party auth (for key management UI/session).
- Blocks: RBAC middleware full rollout.
