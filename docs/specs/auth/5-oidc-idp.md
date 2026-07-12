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

- Endpoints: `/.well-known/openid-configuration`, `/oauth/authorize`, `/oauth/token`, `/oauth/jwks`, `/oauth/userinfo` (paths under `/api/v1` or root — pick one namespace, document in OpenAPI).
- **OIDC client** table: client_id, client_secret_hash (confidential), redirect_uris[], grant_types, scopes_allowed[], m2m_permissions[], created_by account.
- Authorization Code + PKCE (S256); refresh token rotation recommended.
- ID token claims: `sub` (account UUID), `email` (primary mailbox), `name` (display name). No `email_verified`.
- Access token: JWT signed RS256 or ES256; includes `sub`, scopes, client_id, token type (user vs client_credentials).
- Client Credentials: token has `client_id` principal with registered m2m permissions (not tied to **account**).
- User access token on mail API: RBAC middleware resolves OIDC user principal same as session; scopes gate mail endpoints (`mail:read`, `mail:send` minimum).
- Intendant cannot complete user OIDC flows (no primary mailbox / excluded from SSO).
- Consent screen: first-party styled; records granted scopes per account-client pair.

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
