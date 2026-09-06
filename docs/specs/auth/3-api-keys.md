# Spec: API keys

## Problem Statement

At the time this spec was written, **accounts** had no programmatic API access without embedding web **session** cookies, and a shared static bearer token could not represent individual **operators** or their **roles**.

## Solution

Allow any **account** to create, list, and revoke **API keys** (session-only management). Keys authenticate as the holder. Effective access is the intersection of the holder's **role**/assignments and the **scopes** selected on the key — never more than a **session** for that **account**. Security operations (recovery address, sessions, API keys, MFA, passkeys, password change) stay session-only.

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
10. As a **user**, I want API keys to access the mail API endpoints my session can, when the key includes the matching scopes, so that behavior is consistent.
11. As a **user**, I want to pick scopes when creating a key, so that a leaked key is narrower than my full **role**.

## Implementation Decisions

- **API key** table: id, account_id, name, key_prefix (for identification), key_hash, scopes, created_at, last_used_at, revoked_at.
- Authorization header: `Bearer fmu_<random>` (`API_KEY_PREFIX`).
- Key create/list/revoke: authenticated via **session** only; returns secret once on create. At least one grantable scope is required.
- Principal resolution: API key → account → role + assignments + `apiKeyScopes` (same authorize seam as session, plus per-route scope checks).
- Grantable scopes are the subset the holder’s **role** allows. Unknown or ungrantable scopes are rejected.
- Static `API_BEARER_TOKEN` is removed (sessions + API keys + OIDC).

## Testing Decisions

- Create key → use key on authenticated endpoint → success.
- Revoked key → 401.
- Suspended account key → 401.
- User key cannot perform admin-only action → 403.
- Key missing a required scope → 403 even if the holder’s **role** would allow it.
- Prior art: auth middleware integration tests at HTTP boundary.

## Out of Scope

- OIDC client credentials (separate mechanism).
- Key rotation automation (revoke + create).

## Further Notes

- Depends on: Accounts & schema, first-party auth (for key management UI/session).
- Blocks: RBAC middleware full rollout.
- Runtime contract: OpenAPI + [`docs/API.md`](../../API.md). Glossary: **API key** in [`CONTEXT.md`](../../CONTEXT.md).
