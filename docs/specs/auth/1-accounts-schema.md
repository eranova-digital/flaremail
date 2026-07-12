# Spec: Accounts & schema

## Problem Statement

Flaremail V1 has no **account** model. A single shared API token grants full access to every **domain**, **mailbox**, and **message**. The platform cannot support per-person login, role-based administration, invite-based onboarding, or SSO identity.

Operators need a persistent identity layer that links people (**accounts**) to **primary mailboxes**, optional **mailbox grants**, **roles**, and profile data — without overloading the existing mail schema.

## Solution

Introduce an **accounts** domain in Postgres: **accounts**, profile fields, **roles**, **domain assignments**, **shared mailbox assignments**, **invites**, **local part policies**, and links to existing **mailboxes**. Bootstrap the **intendant** at deploy time.

## User Stories

1. As a deployer, I want an **intendant** **account** created automatically at first boot, so that I can configure the instance without pre-creating mail infrastructure.
2. As an **intendant**, I want to sign in with `intendant` and a generated password, so that I can access platform settings without a **mailbox**.
3. As an **intendant**, I want to regenerate my password, so that I can rotate credentials without choosing a custom password.
4. As a **superadmin**, I want a normal **primary mailbox** linked to my **account**, so that I can both administer the platform and use email.
5. As an **admin**, I want my **account** scoped to assigned **domains**, so that I cannot manage domains outside my responsibility.
6. As a **manager**, I want **domain assignments** and **shared mailbox assignments**, so that my administrative powers are limited to the right scope.
7. As a **manager**, I want a wildcard `*` **shared mailbox assignment**, so that I automatically manage all current and future **shared mailboxes** in a **domain**.
8. As a **user**, I want exactly one **primary mailbox**, so that my identity in email is unambiguous.
9. As a **user**, I want **mailbox grants** to additional **mailboxes**, so that I can access **shared mailboxes** alongside my **primary mailbox**.
10. As a **manager**, I want to **invite** a new **account** with a chosen local part on an assigned **domain**, so that new employees get addresses like `patrick@acme.com`.
11. As a **manager**, I want to pre-fill **profile fields** at invite time, so that onboarding captures name and contact data upfront.
12. As an **admin**, I want to lock individual **profile fields**, so that holders cannot change organization-controlled data.
13. As an **admin**, I want to configure a **local part policy** per **domain**, so that manager invites follow `{first_name}.{last_name}` or similar patterns.
14. As an **admin**, I want my own invites pre-filled to the pattern but not constrained by it, so that I can create exceptions when needed.
15. As a **manager**, I want enforced **local part policy** on my invites, so that naming stays consistent.
16. As an invitee, I want my **primary mailbox** to receive mail before I activate, so that early senders are not bounced.
17. As an invitee, I want to remain unable to sign in until I complete activation, so that dormant **accounts** are secure.
18. As a **manager**, I want to auto-send an **invite code** to an external address, so that the invitee receives setup instructions and gets a **recovery address**.
19. As a **manager**, I want to communicate an **invite code** out-of-band, so that I can onboard people without sending external email.
20. As an **admin**, I want to suspend an **account**, so that the person cannot sign in or send mail but inbound delivery continues.
21. As an **admin**, I want to permanently remove an **account**, so that the person is fully deprovisioned and the address can be reused.
22. As a platform, I want removed **account** IDs never reused as OIDC `sub`, so that external systems do not conflate identities.
23. As an **intendant**, I want to assign **admins** to **domains**, so that domain administration is delegated.
24. As an **intendant**, I want to assign **superadmin** to an **account**, so that I can share platform-wide duties.
25. As a **superadmin**, I want to be unable to create other **superadmins**, so that superadmin proliferation is controlled.
26. As an **admin**, I want to assign `user` and `manager` **roles** within my **domains**, so that I can build my team.
27. As a **manager**, I want invites to always create `user` **roles**, so that I cannot escalate privileges.
28. As an **admin**, I want to add a **recovery address** to an **account** that lacks one, so that self-service password reset becomes possible later.
29. As a **user**, I want to edit unlocked **profile fields**, so that I can keep my information current.
30. As a **user**, I want my **display name** formed from **first name** and **last name**, so that humans and OIDC consumers see a sensible name.

## Implementation Decisions

- New tables (conceptual): `accounts`, `account_profiles`, `account_domain_assignments`, `manager_shared_mailbox_assignments` (including wildcard flag), `domain_local_part_policies`, `invites`, `profile_field_locks`.
- **Account** states: `pending` (invited, no password), `active`, `suspended`.
- **Intendant** flag or type discriminator; nullable `primary_mailbox_id` only for intendant.
- Link **primary mailbox** to existing `mailboxes` table (type `primary`); **mailbox grants** as join between `accounts` and `mailboxes`.
- **Role** enum: `user`, `manager`, `admin`, `superadmin`. Intendant is not in the enum.
- **Invite code** format: `XXXX-XXXX`, single use, expires (TTL TBD in implementation, recommend 7 days default).
- **Local part policy** templates: `{first_name}`, `{last_name}`, `{last_name_initial}` at minimum.
- Profile V1 fields: first name, last name, recovery address (optional), address (country, state/county, city, line1, line2) optional, phone optional.
- Services layer: `AccountService`, `InviteService`, `RoleAssignmentService` following ADR-0001 layering.
- Intendant bootstrap runs only via `POST /api/v1/bootstrap` when no intendant account exists; password returned once in the response.
- **Account removal** cascades: revoke grants, hard-delete primary mailbox per existing **hard delete** rules, delete account row but retain ID in tombstone or use non-reused UUID generation.

## Testing Decisions

- Test external behavior: service functions and HTTP endpoints where exposed, not raw SQL.
- Focus on: intendant bootstrap, invite lifecycle, role assignment rules, local part policy enforcement, suspend/remove state transitions, mailbox grant CRUD.
- Prior art: Vitest unit tests in worker `test/*.spec.ts`; pure lib functions tested without DB where possible; integration tests with test DB for schema constraints.
- Use table-driven tests for role assignment matrix (who can assign what).

## Out of Scope

- Password hashing implementation details (covered in first-party auth spec).
- Session and API key tables (covered in sibling specs).
- OIDC tables (covered in OIDC spec).
- Web UI for invites (covered in admin UI spec).
- Audit logging.

## Further Notes

- Depends on: nothing (foundation spec).
- Blocks: all other auth specs.
- Terminology: `docs/CONTEXT.md`, ADR-0005.
