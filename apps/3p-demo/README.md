# 3p-demo

Third-party Next.js app that signs in with **Flaremail as an OIDC provider** (better-auth + Drizzle + SQLite).

## Prerequisites

1. Flaremail worker + web running (`npm run worker:dev`, `npm run web:dev`).
2. An OIDC client in Flaremail Management (intendant/superadmin):
   - **Redirect URI:** `http://localhost:3000/api/auth/oauth2/callback/flaremail`
   - **Allowed scopes:** `openid`, `profile`, `email`
   - **Confidential:** yes
   - **Require consent:** optional
   - **M2M permissions:** leave empty for SSO-only testing

## Setup

```bash
cp apps/3p-demo/.env.example apps/3p-demo/.env
# fill FLAREMAIL_CLIENT_ID / FLAREMAIL_CLIENT_SECRET / BETTER_AUTH_SECRET

npm install
npm run 3p-demo:db:push
npm run 3p-demo:dev
```

Open http://localhost:3000 and click **Sign in with Flaremail**.

## Local URL split

| Env | Default | Why |
|-----|---------|-----|
| `FLAREMAIL_WEB_URL` | `http://localhost:5173` | Browser authorize (session cookie via Vite `/api` proxy) |
| `FLAREMAIL_API_URL` | `http://localhost:8787` | Server-side token + userinfo against the Worker |
| `BETTER_AUTH_URL` | `http://localhost:3000` | This app |

Authorize must go through the web origin so the Flaremail session cookie is sent. Token exchange is server-to-server and does not need that cookie.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run 3p-demo:dev` | Next.js on port 3000 |
| `npm run 3p-demo:db:push` | Apply Drizzle schema to local SQLite |
| `npm run 3p-demo:db:studio` | Drizzle Studio |
