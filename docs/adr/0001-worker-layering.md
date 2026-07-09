# ADR-0001: Worker layering — controllers, services, domain lib

## Status

Accepted

## Context

Outbound writes lived in `lib/messages/*` while reads lived in `services/threads.ts`. Re-export barrels (`thread-mailbox.ts`, `store-email.ts`) added indirection without depth. Contributors could not predict where logic belongs.

## Decision

- **controllers/** — HTTP adapters only: parse request, call a service or domain module, map response.
- **services/** — use-case facades for reads and orchestration that spans multiple domain modules.
- **lib/** — domain modules (threading, folders, MIME, outbound pipelines, thread-mailbox sync).
- **db/** — schema and client.

Thread/mailbox lifecycle updates go through `lib/thread-mailbox/` (`onMessagePersisted`, `onOutboundSent`, `onDraftDeleted`, `onDraftUpdated`).

`ThreadFolder` and `ThreadAction` are defined once in `lib/mailbox-types.ts`.

## Consequences

- New thread/mailbox side effects must use `lib/thread-mailbox`, not call persistence helpers directly from scattered call sites.
- Outbound commands go through `services/outbound-mail`; internal pipeline remains in `lib/messages/*`.
- Shallow re-export barrels are removed or collapsed into purposeful modules.
