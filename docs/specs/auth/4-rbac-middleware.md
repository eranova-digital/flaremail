# Spec: RBAC middleware

## Problem Statement

Every authenticated route today treats a valid token as full access. **Accounts** with `user` **role** can mutate **domains** they do not administer. **Managers** could delete **mailboxes**. There is no 403 — only 401.

## Solution

Replace `requireAuth` with **principal resolution** + **authorization**. Attach resolved **account**, **role**, and assignments to route context. Enforce permissions per route/action based on **role**, **domain assignment**, and **mailbox** access.

## User Stories

1. As a **user**, I want to read/send only on my **primary mailbox** and **mailbox grants**, so that I cannot see others' mail.
2. As a **user**, I want domain listing limited to **domains** of my **mailboxes**, so that I do not discover unrelated infrastructure.
3. As a **manager**, I want to invite/suspend only within my **domain assignments**, so that I cannot affect other **domains**.
4. As a **manager**, I want shared mailbox membership changes only on assigned **shared mailboxes** (or `*`), so that scope is enforced.
5. As an **admin**, I want full CRUD on **mailboxes** and **accounts** within my **domains**, so that I can run the domain.
6. As an **admin**, I want to be blocked from registering new **domains**, so that platform topology stays controlled.
7. As a **superadmin**, I want platform-wide access except creating **superadmins**, so that delegation is safe.
8. As an **intendant**, I want platform-wide management without mail APIs requiring a **mailbox**, so that break-glass works.
9. As an API consumer, I want 401 when unauthenticated and 403 when authenticated but forbidden, so that errors are actionable.
10. As a **suspended account**, I want all mutating and reading mail APIs blocked, so that suspension is enforced uniformly.
11. As a platform, I want system **mailboxes** protected from destructive edits by non-platform roles, preserving existing `isSystemManaged` intent under RBAC.
12. As a **manager**, I want to be unable to remove **accounts** permanently, so that only **admins** can deprovision.
13. As a **manager**, I want to be unable to change **roles**, so that privilege escalation requires **admin**+.
14. As an **admin**, I want to be unable to suspend **admins** or **superadmins** within the domain (default), so that admin lockouts require higher tier.
15. As a **user**, I want thread/message reads scoped to visible **mailboxes**, extending existing `mailboxId` query enforcement.

## Implementation Decisions

- Single seam: `resolvePrincipal(request, env)` → `Principal | Response` then `authorize(principal, action, resource?)` → `void | Response`.
- Extend `RouteContext` with `principal: Principal` where `Principal` includes accountId, role, domainIds, sharedMailboxIds (or wildcard per domain), primaryMailboxId, grantMailboxIds.
- Route definitions gain optional `permission` metadata or centralized permission map keyed by method+path.
- Permission matrix derived from grilling decisions (document in code as enum/const).
- Intendant: allow platform routes (domains, accounts, roles, oidc clients); deny mail read/send without mailbox.
- Replace OpenAPI `bearerAuth` with documented multi-scheme security (session cookie, API key bearer, OIDC JWT).
- Deprecate env `API_BEARER_TOKEN` check in favor of new resolution chain (with migration window if needed).

### Permission matrix (summary)

| Action | user | manager | admin | superadmin | intendant |
|--------|------|---------|-------|------------|-----------|
| Read own mail | ✓ | ✓ | ✓ | ✓ | ✗ |
| Register domain | ✗ | ✗ | ✗ | ✓ | ✓ |
| Invite user | ✗ | ✓* | ✓* | ✓ | ✓ |
| Suspend account | ✗ | ✓* | ✓* | ✓ | ✓ |
| Remove account | ✗ | ✗ | ✓* | ✓ | ✓ |
| Assign roles | ✗ | ✗ | user/manager* | user/manager/admin | all incl superadmin |
| Create shared mailbox | ✗ | ✗ | ✓* | ✓ | ✓ |
| Shared mailbox members | ✗ | ✓† | ✓* | ✓ | ✓ |
| OIDC clients | ✗ | ✗ | ✗ | ✓ | ✓ |

\* Within **domain assignment** scope. † Within **shared mailbox assignment** scope.

## Testing Decisions

- Table-driven HTTP tests: principal fixture × route × expected 200/403/401.
- One integration test per role tier hitting representative routes (domains CRUD, mailboxes CRUD, messages read, invite).
- Do not test permission matrix by mocking internal authorize branches — test via HTTP status and body.
- Prior art: router + `requireAuth` replacement; worker vitest specs.

## Out of Scope

- OIDC scope validation (OIDC spec handles token claims; RBAC consumes resolved principal from OIDC user tokens).
- UI hiding of forbidden actions.
- Fine-grained per-message ACL beyond existing mailbox visibility.

## Further Notes

- Depends on: Accounts schema, first-party auth, API keys (principal sources).
- Blocks: OIDC mail-scope tokens, web/admin UI role awareness.
- Central seam — aim for one test suite covering all credential types feeding same authorize path.
