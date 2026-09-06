# ADR-0015: First-claimer bootstrap

## Status

Accepted

## Context

[ADR-0005](./0005-intendant-break-glass-account.md) required exactly one **intendant**, created at deploy with a deploy-time password. `flaremail deploy` (including CI) has no safe place to print or persist that secret: it must not live in `flaremail.conf.jsonc`, and a GitHub Actions log is not a break-glass channel.

## Decision

The **intendant** is created by **first-claimer**, not at deploy.

- Deploy leaves the **instance** unclaimed (no **intendant** row).
- Unauthenticated `POST /api/v1/bootstrap` (web `/bootstrap`) creates the **intendant** when none exists and returns the generated password once.
- Later calls return `{ created: false }` and never reveal credentials.
- The **installing operator** must bootstrap immediately after deploy — until then anyone who can reach the **gate hostname** can claim the **instance**.

## Considered

- **Password printed by `flaremail deploy` / stored in conf** — CI cannot deliver it to the operator; conf must not hold break-glass credentials.
- **`INTENDANT_PASSWORD` Worker secret** — another secret to mint and rotate; an empty or leaked value is worse than a one-shot claim.
- **CLI-issued, time-limited bootstrap token** — tighter window, more ceremony than the public first-run page.

## Consequences

- [ADR-0005](./0005-intendant-break-glass-account.md) “created at deploy time” / “deploy-time generated password” is superseded. The **intendant** account itself is unchanged.
- Operator docs and [SECURITY.md](../../SECURITY.md) treat immediate bootstrap as a security step. Procedure: [`docs/first-claimer-bootstrap.md`](../first-claimer-bootstrap.md).
