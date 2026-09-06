# Spec: Web auth UI

## Problem Statement

At the time this spec was written, the web app embedded a static `API_BEARER_TOKEN` at build time and had no login, logout, invite activation, or password recovery UI.

## Solution

Add authentication flows to the React web app: login page, logout, invite activation, password reset (recovery + code), session-aware API client, and protected route layout. Replace build-time bearer token with session cookies.

## User Stories

1. As a visitor, I want to see a login page when unauthenticated, so that I can access my mail.
2. As a **user**, I want to sign in with **primary mailbox** and password, so that I reach my inbox.
3. As an **intendant**, I want to sign in with `intendant` and password, so that I can reach platform settings and **system mailboxes**.
4. As a **user**, I want to stay logged in across visits (within session policy), so that UX is smooth.
5. As a **user**, I want to sign out from the UI, so that I end my **session** on shared computers.
6. As an invitee, I want an activation page for my **invite code**, so that I can set my password and profile.
7. As an invitee, I want locked **profile fields** shown read-only at activation, so that I know what I cannot change.
8. As a **user**, I want a "Forgot password" flow using **recovery address**, so that I can self-recover when configured.
9. As a **user**, I want a password reset page accepting **password reset code**, so that I can recover without **recovery address**.
10. As a **user**, I want API errors from expired sessions to redirect to login, so that stale state is handled.
11. As a **user**, I want the compose/inbox experience unchanged once logged in, so that auth is transparent.
12. As a **suspended account** holder, I want a clear message at login, so that I know to contact my admin.
13. As a pending invitee trying to sign in before activation, I want guidance to complete activation, so that I am not confused.
14. As a **user**, I want to manage my **API keys** in settings (basic list/create/revoke), so that I do not need another UI spec for keys.
15. As a **user**, I want to change my password in account settings, so that I can rotate credentials.
16. As a **user**, I want to edit unlocked **profile fields** in settings, so that my information stays current.
17. As an **installing operator**, I want a bootstrap page after first deploy, so that I can become the **first-claimer** and receive the **intendant** password once.

## Implementation Decisions

- Auth provider at app root: session state, current account profile, role.
- API client: `credentials: 'include'` for cookies; no static bearer token in web env.
- Routes: `/login` (includes forgot-password), `/bootstrap`, `/activate`, `/reset-password`, `/oauth/consent`, `/security-compliance`, `/settings`, `/management`, protected mail routes `/m/:mailboxId/...`. Sign-out is `POST /auth/sign-out` (no `/logout` page).
- Post-login redirect: return URL or default inbox (primary mailbox).
- Role-aware navigation: hide platform admin links from `user`/`manager` (coarse; full admin UI separate spec).
- TanStack Query: invalidate on login/logout; 401 interceptor → login.
- Intendant post-login: redirect to `/` (mailbox picker); **system mailboxes** appear in the switcher. Platform admin is `/management`; account security is `/settings`.
- Activation form: invite code (from URL query `?code=` optional), password, confirm password, profile fields per locks.
- MFA, passkeys, and OIDC consent are in-app (not deferred).
- Match existing web design system and component patterns.

## Testing Decisions

- Component tests for forms (validation, locked fields).
- Integration tests optional; manual QA checklist for cookie session flow against dev worker.
- Prior art: `apps/web` vitest tests in `src/lib/*.test.ts`; follow React Testing Library if adding component tests.
- Test external behavior: given mock API responses, login form submits correct payload.

## Out of Scope

- Admin dashboards for invites/roles/OIDC (admin UI spec).
- "Sign in with Google".

## Further Notes

- Depends on: First-party auth, RBAC (for 403 handling in UI), API keys endpoints.
- Coordinate with OpenAPI client regeneration after auth endpoints added.
- **First-claimer** UI: `/bootstrap`. Procedure: [`docs/first-claimer-bootstrap.md`](../../first-claimer-bootstrap.md).
