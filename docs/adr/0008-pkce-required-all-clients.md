# ADR-0008: PKCE required for all authorization code clients

## Status

Accepted

## Context

OAuth 2.0 often required PKCE only for public clients. Confidential clients historically relied on `client_secret` alone. Authorization codes are still interceptable on the redirect path, and a leaked confidential secret would otherwise allow code exchange without a verifier.

## Decision

Require PKCE with method `S256` for **every** Authorization Code flow, public and confidential. Authorize requests without `code_challenge` are rejected; token exchange must present a matching `code_verifier`.

## Consequences

- Relying parties (including confidential backends that start the browser redirect) must implement PKCE.
- Discovery continues to advertise `S256` only.
