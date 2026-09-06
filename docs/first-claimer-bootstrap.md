# First-claimer bootstrap

After `npx flaremail deploy`, the **instance** has no **intendant**. Whoever first succeeds at bootstrap becomes the **first-claimer** and receives the generated password once. Later calls do not create another **intendant** and do not reveal credentials.

This is the only way the **intendant** is created. Deploy does not mint it. See [ADR-0015](./adr/0015-first-claimer-bootstrap.md).

## Security: bootstrap immediately after deploy

Until bootstrap succeeds, `POST /api/v1/bootstrap` is unauthenticated and reachable on the **gate hostname**. Anyone who can hit that origin can claim the **instance**.

Do this in the same sitting as the first deploy (including the first CI deploy to a new **instance**):

1. Deploy (`npx flaremail deploy --yes`).
2. Open `https://<gate-hostname>/bootstrap` at once.
3. Create the **intendant** (UI: recovery account).
4. Copy the password into a secrets manager. It is shown only this once.
5. Sign in with identifier `intendant` and that password.

If the UI says the **instance** is already set up and you did not claim it, treat the **instance** as compromised: someone else is the **first-claimer**.

## Procedure

### Web UI (usual)

1. Visit `https://<gate-hostname>/bootstrap`.
2. Confirm create. Core generates a random password, creates the **intendant**, and returns it in that response only.
3. Store the password. Sign in at `/login` with `intendant`.
4. Rotate later from settings (**regenerate** — never a user-chosen password).

### API

```bash
curl -X POST "https://<gate-hostname>/api/v1/bootstrap"
```

First success: `{ "created": true, "password": "…" }`. After that: `{ "created": false }` (no password). Rate-limited.

Contract: [`API.md`](./API.md) · OpenAPI `POST /api/v1/bootstrap`.

### Local

Same path after `npx flaremail dev` (typically `http://localhost:8787/bootstrap`). Claim local **instances** too — they use the same first-claimer rule.

## After claim

Bootstrap is inert. Recover access with **intendant** **regenerate** while signed in, not by calling bootstrap again.
