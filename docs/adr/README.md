# Architecture decision records

Short records of hard-to-reverse choices. Format: title, context/decision/why (see domain-modeling ADR format). Status is `Accepted` unless noted.

| ADR | Title |
|-----|-------|
| [0001](./0001-worker-layering.md) | Worker layering — controllers, services, domain lib |
| [0002](./0002-domain-readiness-validation.md) | Advisory domain readiness validation |
| [0003](./0003-oidc-subject-is-account-id.md) | OIDC `sub` is account ID, not mailbox address |
| [0004](./0004-first-party-session-vs-oidc-idp.md) | First-party session auth vs OIDC IdP |
| [0005](./0005-intendant-break-glass-account.md) | Intendant as break-glass bootstrap account (creation timing: [0015](./0015-first-claimer-bootstrap.md)) |
| [0006](./0006-system-mailbox-access-by-role.md) | System mailbox access by role |
| [0007](./0007-oidc-token-signing-es256.md) | OIDC tokens signed with ES256 |
| [0008](./0008-pkce-required-all-clients.md) | PKCE required for all authorization code clients |
| [0009](./0009-logs-in-postgres.md) | Logs stored in Postgres |
| [0010](./0010-gate-and-private-core.md) | Gate and private core |
| [0011](./0011-bimi-inbound-brand-marks.md) | BIMI inbound brand marks |
| [0012](./0012-cli-instance-config.md) | CLI owns instance config; Wrangler files are generated |
| [0013](./0013-search-returns-grouped-threads.md) | Search returns grouped threads |
| [0014](./0014-mail-search-query-language.md) | Mail search query language |
| [0015](./0015-first-claimer-bootstrap.md) | First-claimer bootstrap (not deploy-time intendant) |

New ADRs: next number, kebab-case slug, link from this table.
