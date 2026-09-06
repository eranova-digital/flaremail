# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## FlareMail

Do not run `wrangler deploy` or edit `wrangler.jsonc` / app `.env` files by hand. Instance config is `flaremail.conf.jsonc`. Operators and CI use `npx flaremail` — see [`apps/cli/README.md`](./apps/cli/README.md). After changing CLI Wrangler templates, `npx flaremail sync` then `npm run typegen`.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Commands

These are Cloudflare platform commands. For FlareMail deploys, use `npx flaremail`, not `wrangler deploy`.

| Command | Purpose |
|---------|---------|
| `npx wrangler dev` | Local Worker (via `npx flaremail dev`) |
| `npx wrangler types` | Generate TypeScript types |

Run `wrangler types` after `flaremail sync` if CLI Wrangler templates changed.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

## Best Practices (conditional)

If the application uses Durable Objects or Workflows, refer to the relevant best practices:

- Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workflows: https://developers.cloudflare.com/workflows/build/rules-of-workflows/
