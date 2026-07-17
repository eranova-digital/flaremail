# Spec: OIDC IdP

## Problem Statement

Organizations want employees to sign into third-party apps (CRM X) with their Flaremail **account**. Flaremail must act as an OAuth2/OIDC identity provider, not consume external IdPs.

## Solution

Implement OIDC provider endpoints: discovery, authorize, token, JWKS, userinfo. Support Authorization Code + PKCE, refresh tokens, and Client Credentials. Register **OIDC clients** via **intendant**/**superadmin**. Issue tokens per ADR-0003 and ADR-0004.

## User Stories

1. As an **intendant**, I want to register CRM X as an **OIDC client**, so that employees can use Flaremail SSO.
2. As an **intendant**, I want to configure redirect URIs and client type (public/confidential), so that OAuth security requirements are met.
3. As an **intendant**, I want to configure Client Credentials permissions for CRM X's backend, so that server-to-server calls work without a user.
4. As an employee, I want to click "Sign in with Flaremail" in CRM X and authenticate, so that I use one identity.
5. As an employee, I want CRM X to receive my `email` and `name`, so that my profile is populated.
6. As CRM X, I want `sub` to be a stable **account** ID, so that I key users correctly across email address changes (ADR-0003).
7. As CRM X, I want refresh tokens, so that sessions persist without frequent re-login.
8. As a **suspended account** holder, I want OIDC authorize to fail immediately, so that SSO is cut off.
9. As CRM X, I want to request scopes like `openid`, `profile`, `email`, `mail:read`, `mail:send`, so that I can access identity and optionally mail API.
10. As CRM X, I want OIDC discovery document at well-known URL, so that integration is standard.
11. As CRM X backend, I want Client Credentials token with configured service permissions, so that I can sync data without a user present.
12. As a **user**, I want to see a consent screen listing requested scopes when authorizing CRM X, so that I understand what I grant.
13. As a platform, I want PKCE required for public clients, so that authorization code interception is mitigated.
14. As a **superadmin**, I want to manage **OIDC clients**, so that **intendant** is not a bottleneck.
15. As CRM X, I want user access tokens validated on Flaremail mail API when `mail:*` scopes granted, so that one token can call mail endpoints per ADR-0004.

## Implementation Decisions

- Endpoints: `/.well-known/openid-configuration`, `/api/v1/oauth/authorize`, `/api/v1/oauth/token`, `/api/v1/oauth/jwks`, `/api/v1/oauth/userinfo`, plus `/api/v1/oauth/pending/:id` and `/api/v1/oauth/consent` for the web consent UI.
- **OIDC client** table: client_id, client_secret_hash (confidential), redirect_uris[], allowed_scopes[], m2m_permissions[], is_confidential, require_consent (default true), created_by account.
- Authorization Code + PKCE (**S256 required for all clients**, ADR-0008); refresh token rotation with family reuse detection.
- ID/access tokens signed **ES256** via `OIDC_SIGNING_JWK` (ADR-0007); JWKS publishes the public key only.
- Redirect URI validation: exact string match; OAuth error redirects only when client_id and redirect_uri are both valid.
- Unauthenticated authorize → web `/login?return_to=…` then resume pending authorization; consent UI at web `/oauth/consent`.
- Consent grants persisted per account–client when require_consent; skipped with no grant row when require_consent is false. Self-service and intendant/superadmin revoke.
- Client Credentials: token has `client_id` principal with registered m2m permissions (not tied to **account**).
- User access token on mail API: RBAC middleware resolves OIDC user principal same as session; scopes gate mail endpoints (`mail:read`, `mail:send` minimum).
- Intendant cannot complete user OIDC flows (no primary mailbox / excluded from SSO).
- TTLs: authorization code 10m, access/ID 1h, refresh 30d.
- Admin: list/update/delete/regenerate-secret under `/api/v1/oidc-clients`; web Management → OIDC clients tab.

### Scope vocabulary (V1)

- `openid`, `profile`, `email` — identity
- `mail:read` — read messages/threads on accessible mailboxes
- `mail:send` — send/reply/forward on accessible mailboxes
- Admin/management scopes: out of scope for V1 OIDC (use session/API key)

## Testing Decisions

- OIDC conformance-style tests: discovery document shape, authorize redirect with code, token exchange, JWKS validates signature.
- Test suspended user authorize → error.
- Test Client Credentials token → allowed m2m endpoint; denied without permission.
- Test user token with `mail:read` → can GET message; without scope → 403.
- Prior art: HTTP tests in worker vitest; consider golden tests for JWT claims shape.

## Out of Scope

- SAML.
- Social login (Google/GitHub) as IdP consumer.
- Dynamic client registration.
- Per-client custom claims beyond standard profile.
- Federation across Flaremail instances.

## Further Notes

- Depends on: Accounts schema, RBAC middleware.
- Blocks: External CRM integrations; optional mail API access via OIDC tokens.
- ADRs: 0003, 0004.
