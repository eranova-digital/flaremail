# ADR-0003: OIDC `sub` is account ID, not mailbox address

## Status

Accepted

## Context

Flaremail is positioned as a single-tenant SSO source (OAuth2/OIDC IdP). Relying parties such as CRM X need a stable subject identifier. **Primary mailbox** addresses are reused after **account removal** — a removed `patrick@acme.com` may later be invited to a different person.

If `sub` were the mailbox address, identity would collide across people. If address reuse were forbidden, operators would lose a useful administrative capability.

## Decision

- The OIDC `sub` claim is an opaque, stable **account** ID (UUID or equivalent).
- The **primary mailbox** address is emitted as the `email` claim (and in `name` via **display name** from **first name** + **last name**).
- `sub` is never reused after **account removal**.
- There is no `email_verified` claim — **accounts** are invite-based; the platform is the source of truth for addresses.
- The **intendant** does not participate in SSO (no **primary mailbox**).

## Consequences

- Relying parties must key users on `sub`, not `email`. Documentation for **OIDC client** integrators must state this explicitly.
- **Account removal** frees the mailbox address without breaking CRM identity for the removed person (their `sub` is gone).
- Re-inviting the same address creates a new **account** ID and a new `sub`.
