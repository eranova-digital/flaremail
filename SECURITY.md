# Security

If you find a security vulnerability in FlareMail, email **security@eranova.ro**.

Do not report it in a public GitHub issue, discussion, or pull request.

Please include enough detail to reproduce the problem. Do not send real mailbox contents, passwords, or other secrets from a live system.

We will acknowledge the report and work with you on a fix before any public disclosure.

## Operators

**Bootstrap immediately after deploy.** A new **instance** has no **intendant** until someone claims it. `POST /api/v1/bootstrap` is unauthenticated: whoever succeeds first is the **first-claimer** and owns the **instance**. Do this in the same sitting as the first deploy (including the first CI deploy). If the **instance** is already claimed and you did not do it, treat that as a compromise.

Procedure: [`docs/first-claimer-bootstrap.md`](./docs/first-claimer-bootstrap.md). Keep `flaremail.conf.jsonc` and generated Wrangler / `.env` files out of git. Treat the **intendant** password as break-glass.
