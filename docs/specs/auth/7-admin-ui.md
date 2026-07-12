# Spec: Admin UI

## Problem Statement

**Intendant**, **superadmin**, **admin**, and **manager** **roles** need UI to perform administrative actions defined in the domain model — invites, role changes, suspensions, **shared mailbox** management, **local part policy**, **OIDC clients** — without raw API calls.

## Solution

Add administration sections to the web app, gated by **role** and assignments. Separate platform admin (intendant/superadmin) from domain admin (admin/manager).

## User Stories

### Platform (intendant / superadmin)

1. As an **intendant**, I want to register a new **domain**, so that the organization can send and receive mail.
2. As a **superadmin**, I want to register a new **domain**, so that I can grow the platform.
3. As an **intendant**, I want to assign an **admin** to a **domain**, so that administration is delegated.
4. As an **intendant**, I want to promote an **account** to **superadmin**, so that I can share platform duties.
5. As a **superadmin**, I want to assign **admins** to **domains**, so that I can delegate without the intendant.
6. As an **intendant**, I want to register an **OIDC client**, so that CRM X can integrate SSO.
7. As a **superadmin**, I want to edit **OIDC client** redirect URIs and M2M permissions, so that integrations stay current.
8. As an **intendant**, I want to regenerate my password from the UI, so that break-glass rotation is self-service.
9. As a **superadmin**, I want to list all **accounts** on the instance, so that I have platform visibility.

### Domain admin

10. As an **admin**, I want to invite a new **account** on my **domain**, so that employees get **primary mailboxes**.
11. As an **admin**, I want to pre-fill and lock **profile fields** on invite, so that HR data is controlled.
12. As an **admin**, I want to configure **local part policy** for my **domain**, so that addresses follow convention.
13. As an **admin**, I want to create a **shared mailbox**, so that teams have addresses like `sales@acme.com`.
14. As an **admin**, I want to assign a **manager** to **shared mailboxes** or `*`, so that delegation is structured.
15. As an **admin**, I want to promote **accounts** to **manager** within my **domains**, so that team leads can invite.
16. As an **admin**, I want to suspend an **account** in my **domain**, so that I can offboard access quickly.
17. As an **admin**, I want to permanently remove an **account**, so that deprovisioning is complete.
18. As an **admin**, I want to add a **recovery address** to an **account**, so that users gain self-service reset.
19. As an **admin**, I want to manage **mailbox grants** for **shared mailboxes**, so that membership is correct.
20. As an **admin**, I want to CRUD non-shared **mailboxes** in my **domain**, so that I control addresses and aliases.

### Manager

21. As a **manager**, I want to invite **users** on my assigned **domains**, so that I can grow my team.
22. As a **manager**, I want to auto-send **invite codes** or copy them, so that onboarding is flexible.
23. As a **manager**, I want to suspend **users** in my **domains**, so that I can respond to HR requests.
24. As a **manager**, I want to issue **password reset codes**, so that I can help users without **recovery address**.
25. As a **manager**, I want to add/remove **accounts** on **shared mailboxes** I manage, so that team access is correct.
26. As a **manager**, I want to be blocked from creating **shared mailboxes**, so that address provisioning stays with **admins**.
27. As a **manager**, I want to be blocked from removing **accounts** permanently, so that destructive actions need **admin**.

### UX

28. As any admin **role**, I want to see only actions my **role** permits, so that the UI does not tease forbidden operations.
29. As an **admin**, I want to search/filter **accounts** in my **domain**, so that I can find people quickly.
30. As a **manager**, I want invite local part preview from **profile fields** when policy enforced, so that I see the resulting address before sending.

## Implementation Decisions

- Route structure: `/admin/platform/*` (intendant/superadmin), `/admin/domains/:domainId/*` (admin/manager scoped).
- Platform pages: domains list/create, account list, role assignment, OIDC clients CRUD, intendant password regenerate.
- Domain pages: accounts, invites, mailboxes, shared mailboxes, managers assignment, local part policy editor.
- Manager view: subset of domain pages without mailbox create/delete, role promotion above manager, or account removal.
- Forms call new admin API endpoints (or existing v1 routes once RBAC applied).
- Wildcard `*` shared mailbox assignment shown clearly in UI.
- Local part policy: template builder with `{first_name}`, `{last_name}`, `{last_name_initial}` preview.
- Invite flow: choose domain (from assignments), local part (validated), profile fields with lock toggles, send option.

## Testing Decisions

- Role-based route guard tests: manager cannot navigate to platform routes.
- Form validation tests for local part policy preview.
- Manual QA matrix: each role × page access.
- Prior art: existing web app routing and TanStack Query patterns.

## Out of Scope

- Domain readiness validation UI changes (existing feature stays).
- Audit log viewer.
- Bulk import CSV.
- Billing.

## Further Notes

- Depends on: All backend specs (accounts, auth, RBAC, OIDC for client admin).
- Can parallelize partially with web auth UI after RBAC endpoints exist.
- Use `docs/CONTEXT.md` labels in all user-facing copy (Account, not User account).
