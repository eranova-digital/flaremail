# 3p-demo

Third-party Next.js app that signs in with **Flaremail as an OIDC provider** (better-auth + Drizzle + SQLite).

## Topology

| App | URL |
|-----|-----|
| 3p-demo | http://localhost:3000 |
| Flaremail web | http://localhost:5173 |
| Flaremail Worker | your deployed Worker URL (e.g. `https://your-worker.workers.dev`) |

## Prerequisites

1. Deployed Worker reachable at your Worker URL, with `WEB_ORIGIN=http://localhost:5173` (so login/consent redirect to the local SPA, not the Worker host).
2. Flaremail web running locally with proxy to that Worker:

```bash
# apps/web/.env
API_URL=/api/v1
API_PROXY_TARGET=https://your-worker.workers.dev
```

```bash
npm run web:dev
```

3. An OIDC client in Flaremail Management (intendant/superadmin):
   - **Redirect URI:** `http://localhost:3000/api/auth/oauth2/callback/flaremail`
   - **Allowed scopes:** `openid`, `profile`, `email`
   - **Confidential:** yes
   - **Require consent:** optional
   - **M2M permissions:** leave empty for SSO-only testing

## Setup

```bash
cp apps/3p-demo/.env.example apps/3p-demo/.env
# set FLAREMAIL_API_URL to your Worker, plus CLIENT_ID / SECRET / BETTER_AUTH_SECRET

npm install
npm run 3p-demo:db:push
npm run 3p-demo:dev
```

Open http://localhost:3000 and click **Sign in with Flaremail**.

## Env

| Env | Default | Why |
|-----|---------|-----|
| `FLAREMAIL_WEB_URL` | `http://localhost:5173` | Browser authorize (session cookie on the web origin; Vite proxies `/api` to the Worker) |
| `FLAREMAIL_API_URL` | *(required)* your Worker origin | Server-side token + userinfo + issuer |
| `BETTER_AUTH_URL` | `http://localhost:3000` | This app |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run 3p-demo:dev` | Next.js on port 3000 |
| `npm run 3p-demo:db:push` | Apply Drizzle schema to local SQLite |
| `npm run 3p-demo:db:studio` | Drizzle Studio |
