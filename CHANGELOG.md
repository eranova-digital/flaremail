# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-09-06

First stable release of FlareMail: self-hosted email for your domains on Cloudflare Workers.

### Added

- Public **gate** Worker (SPA + `/api` proxy) and private **core** Worker (mail, HTTP API, crons, bindings)
- Catch-all inbound mail via Email Routing; send, reply, and forward via Email Sending
- Threads, labels, drafts, attachments, shared mailboxes, and system mailboxes
- Web mail UI with responsive layout, compose, search, and settings
- Versioned HTTP API (`/api/v1`) with OpenAPI 3.1, RFC 9457 Problem Details, and cursor pagination
- Session cookies, API keys, MFA, passkeys, recovery email, and an OIDC identity provider
- First-claimer bootstrap that creates the **intendant** after deploy
- Operator CLI (`npx flaremail`) for instance config, health, apply, and deploy
- Mail search query language with grouped thread results and operator pills in the threadlist
- Signed-in password change
- BIMI brand marks on inbound mail after DMARC
- Identities with name patterns and signatures; email and system templates
- Instance settings, audit logs, and domain readiness validation
- 13 UI locales
- GitHub Actions CI and production deploy on `master` via the CLI

### Security

- A new instance has no **intendant** until someone claims it. `POST /api/v1/bootstrap` is unauthenticated until that succeeds — complete first-claimer bootstrap in the same sitting as the first deploy. See [SECURITY.md](./SECURITY.md) and [first-claimer bootstrap](./docs/first-claimer-bootstrap.md).

[unreleased]: https://github.com/eranova-digital/flaremail/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/eranova-digital/flaremail/releases/tag/v1.0.0
