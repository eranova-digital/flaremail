# Documentation

Canonical docs for Flaremail beyond the app READMEs.

| Doc | Purpose |
|-----|---------|
| [CONTEXT.md](./CONTEXT.md) | Ubiquitous language (glossary only — no implementation detail) |
| [API.md](./API.md) | Human-readable HTTP API (v1) |
| [adr/](./adr/) | Architecture decision records |
| [specs/auth/](./specs/auth/) | Auth & authorization design specs |

## App READMEs

| App | README |
|-----|--------|
| Monorepo | [../README.md](../README.md) |
| Core | [../apps/core/README.md](../apps/core/README.md) |
| Gate | [../apps/gate/README.md](../apps/gate/README.md) |
| Web | [../apps/web/README.md](../apps/web/README.md) |

## How to use these docs

1. **Product terms** — read `CONTEXT.md` before naming things in code or UI copy.
2. **Why the system looks like this** — browse `adr/` (start with [0010](./adr/0010-gate-and-private-core.md) for packaging, [0001](./adr/0001-worker-layering.md) for core layering).
3. **HTTP contract** — OpenAPI in `apps/core/openapi.yaml` is authoritative; `API.md` is the narrative companion.
4. **Auth behaviour** — `specs/auth/` in dependency order (see that folder’s README).

Agent contributors: follow root [`AGENTS.md`](../AGENTS.md) for Cloudflare Workers docs (always fetch current platform docs).
