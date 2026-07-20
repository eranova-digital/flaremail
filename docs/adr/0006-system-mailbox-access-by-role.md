# ADR-0006: System mailbox access by role

## Status

Accepted

## Context

Each **domain** auto-provisions **system mailboxes** (`postmaster@`, `noreply@`, `abuse@`). Operators need to monitor and respond from `postmaster@` (DMARC reports, abuse routing, validation loops). [ADR-0005](./0005-intendant-break-glass-account.md) originally blocked the **intendant** from all mail APIs so break-glass could work without a **primary mailbox**.

In practice, platform operators still need read/send access to **system mailboxes** — especially `postmaster@` — without impersonating user inboxes. **Admins** need the same for **domains** they administer.

## Decision

### System mailboxes

A **system mailbox** is any mailbox where `isSystemManaged: true` in the API — today:

| Address | Type | Receives | Sends | Notes |
|---------|------|----------|-------|-------|
| `postmaster@` | `system` | Yes | Yes | Primary operational system inbox |
| `noreply@` | `blackhole` | No | Yes | Outbound-only |
| `abuse@` | `alias` | Forwards to postmaster | No | Not selectable in the web mailbox switcher |

System mailboxes remain immutable (no edit/delete) for all roles.

### Mailbox access by role

| Role | Mailboxes visible in `GET /mailboxes` | Mail read/send scope |
|------|--------------------------------------|----------------------|
| **user** | **Primary mailbox** + **mailbox grants** (shared only) | Same |
| **manager** | **Primary mailbox** + assigned **shared mailboxes** | Same |
| **admin** | **Primary mailbox** + all **shared mailboxes** on assigned **domains** | Same |
| **superadmin** | **Primary mailbox** + all **shared mailboxes** on the instance | Same |
| **intendant** | All **system mailboxes** + all **shared mailboxes** | Same |

The **intendant** still has no **primary mailbox**, no **mailbox grants**, and no SSO participation. It cannot read or send from user, shared, or non-system mailboxes.

### Enforcement

1. **List filtering** — `GET /mailboxes` returns only mailboxes the principal may see.
2. **Mailbox-scoped mail APIs** — thread, message, label, search, send, and draft endpoints call `assertPrincipalCanAccessMailbox` with the request `mailboxId` before data access.
3. **Route authorization** — the **intendant** is no longer blanket-denied `mail_read` / `mail_write`; scope is enforced per mailbox instead.

## Consequences

- [ADR-0005](./0005-intendant-break-glass-account.md) is amended: the **intendant** may use mail APIs for **system mailboxes** and **shared mailboxes** only — never user **primary mailboxes**.
- Web app: **intendant** post-login redirect goes to `/` (mailbox picker) so system inboxes are reachable; platform settings remain under `/settings`.
- OIDC userinfo and authorization still reject the **intendant** (no **primary mailbox** for SSO).
- Future per-route mailbox scoping for **user** / **manager** roles beyond list filtering is unchanged.

## References

- Implementation: `filterMailboxesForPrincipal` / `authorizeMailbox` via `apps/core/src/lib/auth/access.ts` (policy helpers live in `mailbox-access.ts`)
- Glossary: [`CONTEXT.md`](../CONTEXT.md) — **System mailbox**, **Intendant**
- API: [`API.md`](../API.md) — Mailbox access
