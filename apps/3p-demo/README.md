# 3p-demo

Third-party Next.js app that signs in with **Flaremail as an OIDC provider** (better-auth + Drizzle + SQLite).

## Topology

| App | URL |
|-----|-----|
| 3p-demo | http://localhost:3000 |
| Flaremail web (Vite) | http://localhost:5173 |
| Flaremail **instance** | your **gate hostname** (e.g. `https://mail.example.com`) |

## Prerequisites

1. A deployed FlareMail **instance** ([CLI](../cli/README.md)). For local Vite against that instance, `web.apiProxyTarget` in `flaremail.conf.jsonc` should be the gate hostname, then `npx flaremail sync`.
2. Flaremail web running locally:

```bash
npx flaremail sync
npm run web:dev
```

3. An OIDC client in Flaremail Management (intendant/superadmin):
   - **Redirect URI:** `http://localhost:3000/api/auth/oauth2/callback/flaremail`
   - **Allowed scopes:** `openid`, `profile`, `email`
   - **Confidential:** yes
   - **Require consent:** optional
   - **M2M permissions:** leave empty for SSO-only testing

## Setup

This demo has its **own** `.env` (not the FlareMail instance conf):

```bash
cp apps/3p-demo/.env.example apps/3p-demo/.env
# FLAREMAIL_API_URL = gate hostname origin
# plus CLIENT_ID / SECRET / BETTER_AUTH_SECRET

npm install
npm run 3p-demo:db:push
npm run 3p-demo:dev
```

Open http://localhost:3000 and click **Sign in with Flaremail**.

## Env

| Env | Default | Why |
|-----|---------|-----|
| `FLAREMAIL_WEB_URL` | `http://localhost:5173` | Browser authorize (session cookie on the web origin; Vite proxies `/api` to the gate) |
| `FLAREMAIL_API_URL` | *(required)* gate hostname origin | Server-side token + userinfo + issuer |
| `BETTER_AUTH_URL` | `http://localhost:3000` | This app |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run 3p-demo:dev` | Next.js on port 3000 |
| `npm run 3p-demo:db:push` | Apply Drizzle schema to local SQLite |
| `npm run 3p-demo:db:studio` | Drizzle Studio |
