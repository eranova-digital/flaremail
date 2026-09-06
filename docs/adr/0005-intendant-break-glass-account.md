# ADR-0005: Intendant as break-glass bootstrap account

## Status

Accepted. Creation timing superseded by [ADR-0015](./0015-first-claimer-bootstrap.md) (amendment 2026-09-06). System-mailbox access amended by [ADR-0006](./0006-system-mailbox-access-by-role.md).

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

## Amendment (2026-09-06)

Superseded in part by [ADR-0015](./0015-first-claimer-bootstrap.md):

- The **intendant** is **not** created at deploy time. Deploy leaves the **instance** unclaimed.
- Creation is **first-claimer**: unauthenticated `POST /api/v1/bootstrap` (web `/bootstrap`) when no **intendant** exists. The generated password is returned once in that response — not a deploy-time secret.
- The **installing operator** must bootstrap immediately after deploy. Until claim succeeds, anyone who can reach the **gate hostname** can become the **intendant**. Procedure: [`docs/first-claimer-bootstrap.md`](../first-claimer-bootstrap.md). Security step: [`SECURITY.md`](../../SECURITY.md).

## Amendment (2026-07-12)

Superseded in part by [ADR-0006](./0006-system-mailbox-access-by-role.md):

- The **intendant** may read and send mail on **system mailboxes** (`postmaster@`, `noreply@`, and system-managed aliases such as `abuse@`) and on all **shared mailboxes**.
- The **intendant** still cannot hold a **primary mailbox**, **mailbox grants**, or participate in SSO, and cannot access user **primary mailboxes**.
