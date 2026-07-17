# ADR-0007: OIDC tokens signed with ES256

## Status

Accepted

## Context

The OIDC IdP currently signs access and ID tokens with HS256 using `SESSION_SECRET` and exposes that shared secret via JWKS. That is unsuitable for production relying parties, which expect asymmetric verification via a public JWKS document.

## Decision

Sign OIDC access and ID tokens with **ES256** (ECDSA P-256). Store the private key as a Worker secret; publish the public JWK (with `kid`) from `/api/v1/oauth/jwks`. Discovery advertises `ES256` only for ID token signing algorithms.

RS256 was rejected: larger keys and JWTs for no gain with modern RPs. HS256 was rejected: cannot publish a verification key without leaking the signing secret.

## Consequences

- Deploy/setup must provision an ES256 key pair (not reuse `SESSION_SECRET`).
- Existing HS256 tokens become invalid after cutover; acceptable for pre-production IdP traffic.
- Key rotation can later add a second `kid` without changing the algorithm choice.
