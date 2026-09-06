# Spec: First-party auth

## Problem Statement

At the time this spec was written, the web app and API consumers had no first-party identity: invitees could not activate **accounts**, and the **intendant** needed a bootstrap path distinct from OIDC.

## Solution

Implement first-party authentication: sign-in endpoint, session issuance and validation, password setup (invite activation), password change, self-service reset (recovery address), and admin/manager-assisted reset (password reset code). Separate from OIDC per ADR-0004.

## User Stories

1. As a **user**, I want to sign in with my **primary mailbox** address and password, so that I can access the web app.
2. As an **intendant**, I want to sign in with `intendant` and my generated password, so that I can manage the platform.
3. As an invitee, I want to submit my **invite code** and set a password, so that my **account** becomes active.
4. As an invitee, I want to complete unlocked **profile fields** at activation, so that my record is accurate.
5. As a **user**, I want to sign out, so that my **session** ends on shared devices.
6. As a **user**, I want my **session** to persist across browser restarts (within policy), so that I am not constantly re-authenticating.
7. As a **user** with a **recovery address**, I want to request a password reset email, so that I can recover access without an admin.
8. As a **user** without a **recovery address**, I want to obtain a **password reset code** from my **manager** or **admin**, so that I can reset my password out-of-band.
9. As a **manager**, I want to issue a **password reset code**, so that I can help users who lack a **recovery address**.
10. As a **user**, I want to change my password when logged in, so that I can rotate credentials proactively.
11. As an **intendant**, I want to regenerate my password (not set a custom one), so that break-glass security is maintained per ADR-0005.
12. As a **suspended account** holder, I want sign-in rejected, so that suspension takes effect immediately.
13. As a pending **account** holder, I want sign-in rejected until activation completes, so that invitees cannot access before setup.
14. As the platform, I want failed sign-in attempts rate-limited, so that brute force is mitigated.
15. As a **user**, I want clear error messages distinguishing wrong password vs suspended vs pending, so that I know what action to take.
16. As an **installing operator**, I want the **intendant** password surfaced once at **first-claimer** bootstrap, so that I can store it in a secrets manager.

## Implementation Decisions

- Sign-in endpoint accepts `{ email, password }` where `email` is **primary mailbox** address or `intendant`.
- Password storage: PBKDF2 via Web Crypto; never store plaintext except transient display on intendant regenerate.
- **Session** table: session ID, account ID, expiry, created at, user agent hash optional.
- Session delivery: HttpOnly Secure SameSite cookie (`flaremail_session`) for web.
- Session validation middleware feeds **principal resolution** seam (shared with API keys and OIDC).
- Invite activation endpoint: `{ invite_code, password, profile_updates? }` → activates account, creates session optional.
- **Password change**: authenticated non-intendant endpoint `{ currentPassword, newPassword, code? }`. Requires the current password and TOTP when MFA is enabled. New password must meet strength rules and differ from the current one. Revokes other **sessions**; keeps the current **session**. Session-only.
- Password reset via recovery: send email to **recovery address** with one-time token (distinct from invite code and password reset code).
- **Password reset code**: manager/admin generates `XXXX-XXXX` style code; single use; allows new password set without login.
- Intendant regenerate: authenticated intendant-only endpoint; returns new password once in response body; invalidates old password.
- MFA (TOTP) and passkeys: session-managed; MFA verify and passkey sign-in are public completion endpoints. See OpenAPI `/auth/mfa*` and `/auth/passkeys*`.
- Public routes: **first-claimer** bootstrap, sign-in, invite activation, password reset request/confirm, MFA verify, passkey sign-in, health, openapi.
- Session TTL: idle lifetime 7 days (see OpenAPI `sessionCookie`).

## Testing Decisions

- HTTP-level tests: sign-in success/failure, session cookie set, authenticated request passes, sign-out clears session.
- Test suspended and pending rejection without testing hash algorithm internals.
- Test invite activation flow end-to-end with fixture account.
- Test intendant sign-in and regenerate separately from normal accounts.
- Test password change separately from reset and intendant regenerate (wrong current password, MFA required, other sessions revoked).
- Prior art: worker Vitest; mock env and DB; consider miniflare/workers pool for cookie handling.

## Out of Scope

- OIDC authorize/login flows.
- API keys.
- Web UI pages (separate spec).
- Email delivery implementation for recovery/invite send.

## Further Notes

- Depends on: Accounts & schema spec.
- Blocks: RBAC middleware, web auth UI.
- ADRs: 0004, 0005, 0015. Procedure: [`docs/first-claimer-bootstrap.md`](../../first-claimer-bootstrap.md).
