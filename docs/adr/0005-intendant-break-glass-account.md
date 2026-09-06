# ADR-0005: Intendant as break-glass bootstrap account

## Status

Accepted

## Context

Each Flaremail instance is single-tenant. Someone must bootstrap the platform: register the first **domain**, assign **admins**, register **OIDC clients**, and mint the first **superadmin**. This account must survive misconfiguration of roles and cannot be removed by operators.

## Decision

- Exactly one **intendant** **account** is created at deploy time.
- The **intendant** has no **primary mailbox** and cannot hold **mailbox grants** — it does not participate in email operations or SSO.
- Signs in with `email: "intendant"` (reserved identifier, not an email address) and a deploy-time generated password.
- Password is never user-chosen. The **intendant** may **regenerate** it (new random secret); no conventional password-change flow.
- The **intendant** cannot be deleted. Its privileges are not a assignable **role**.
- The **intendant** can: register **domains**, assign any **role** (including **superadmin**), assign **admins** to **domains**, and register **OIDC clients**.
- **Superadmins** cannot create other **superadmins** — only the **intendant** can.

## Consequences

- **Account** schema must allow null **primary mailbox** for the intendant only.
- Sign-in endpoint must accept the reserved `intendant` identifier.
- First-boot UI surfaces the deploy-time password once; regeneration is in-app. Instance install is [`apps/cli/README.md`](../../apps/cli/README.md), not a Wrangler runbook.
- OIDC and mail APIs reject intendant tokens for user-scoped operations that require a **primary mailbox**.

## Amendment (2026-07-12)

Superseded in part by [ADR-0006](./0006-system-mailbox-access-by-role.md):

- The **intendant** may read and send mail on **system mailboxes** only (`postmaster@`, `noreply@`, and system-managed aliases such as `abuse@`).
- The **intendant** still cannot hold a **primary mailbox**, **mailbox grants**, or participate in SSO.
