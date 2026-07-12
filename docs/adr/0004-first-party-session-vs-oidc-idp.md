# ADR-0004: First-party session auth vs OIDC IdP

## Status

Accepted

## Context

Flaremail needs authentication for the web UI, programmatic API access, and third-party SSO (e.g. CRM X using Flaremail as sign-in). These channels have different trust boundaries and token lifetimes.

V1 used a single shared `API_BEARER_TOKEN` with no per-**account** identity.

## Decision

Use four distinct credential channels:

1. **Session** — first-party web app only. **Accounts** sign in via email/password (or the reserved `intendant` identifier). The server issues a session credential (cookie or equivalent). Not OIDC.

2. **API key** — per-**account** long-lived credentials. Any **account** can create and revoke keys. Keys inherit exactly the holder's **role** and assignments.

3. **OIDC user tokens** — third-party relying parties. Authorization Code + PKCE, refresh tokens. User access tokens may call the Flaremail mail API when the authorize request includes required scopes (e.g. `mail:read`, `mail:send`). Identity claims follow ADR-0003.

4. **Client Credentials** — machine-to-machine for registered **OIDC clients**. Permissions are configured per client at registration, independent of any **account**.

The OIDC authorize/token endpoints serve external relying parties. The web app does not act as an OIDC client of itself.

## Consequences

- Auth middleware must distinguish session, API key, OIDC user token, and client-credentials token types.
- OpenAPI documents multiple security schemes replacing the single static bearer token.
- Web login UX is independent of OIDC consent screens.
- CRM X integration uses standard OIDC; Flaremail web uses a simpler first-party flow.
