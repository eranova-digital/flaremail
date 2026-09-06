# Documentation

Canonical docs for Flaremail beyond the app READMEs.

| Doc | Purpose |
|-----|---------|
| [CONTEXT.md](./CONTEXT.md) | Ubiquitous language (glossary only — no implementation detail) |
| [API.md](./API.md) | Human-readable HTTP API (v1) |
| [SECURITY.md](../SECURITY.md) | Vulnerability reporting, supported versions, operator security steps |
| [first-claimer-bootstrap.md](./first-claimer-bootstrap.md) | Claim the **intendant** immediately after deploy |
| [adr/](./adr/) | Architecture decision records |
| [specs/auth/](./specs/auth/) | Auth & authorization design specs |

## App READMEs

| App | README |
|-----|--------|
| Monorepo | [../README.md](../README.md) |
| CLI | [../apps/cli/README.md](../apps/cli/README.md) |
| Core | [../apps/core/README.md](../apps/core/README.md) |
| Gate | [../apps/gate/README.md](../apps/gate/README.md) |
| Web | [../apps/web/README.md](../apps/web/README.md) |
| 3p-demo | [../apps/3p-demo/README.md](../apps/3p-demo/README.md) |

## How to use these docs

1. **Install / deploy / config** — [`apps/cli/README.md`](../apps/cli/README.md) (`npx flaremail`). After the first deploy, [first-claimer bootstrap](./first-claimer-bootstrap.md) immediately ([SECURITY.md](../SECURITY.md)).
2. **Product terms** — read `CONTEXT.md` before naming things in code or UI copy.
3. **Why the system looks like this** — browse `adr/` (start with [0010](./adr/0010-gate-and-private-core.md) for packaging, [0012](./adr/0012-cli-instance-config.md) for instance config, [0001](./adr/0001-worker-layering.md) for core layering).
4. **HTTP contract** — OpenAPI in `apps/core/openapi.yaml` is authoritative; `API.md` is the narrative companion.
5. **Auth behaviour** — `specs/auth/` in dependency order (see that folder’s README).

Agent contributors: follow root [`AGENTS.md`](../AGENTS.md) for Cloudflare Workers docs (always fetch current platform docs).
