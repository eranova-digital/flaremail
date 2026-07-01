# Email Platform

A Cloudflare Worker that receives inbound mail, stores messages in Postgres and R2, and exposes a versioned HTTP API for mailbox management and outbound operations.

## Language

**Domain**:
A registered internet domain the platform accepts mail for and can send from.
_Avoid_: zone, site

**Mailbox**:
An email address on a domain that can receive, store, and (when not an alias) send mail.
_Avoid_: account, user, inbox

**Alias mailbox**:
A mailbox address that forwards inbound routing to a target receiving mailbox without storing its own copy.
_Avoid_: forwarder, redirect

**Thread**:
A conversation grouping related messages by shared subject context. Global identity lives on `threads`; per-mailbox UI state (folder, read, starred, preview, counts) lives on `thread_mailboxes`.
_Avoid_: conversation (in API paths), chain

**Message visibility**:
Which mailboxes can see a message, tracked in `message_mailboxes`. Populated from sender/recipient addresses that resolve to platform mailboxes. A mailbox linked to a thread via `thread_mailboxes` only sees messages it has visibility to.

**Message**:
A single email stored in the system, whether inbound, outbound, draft, or failed send.
_Avoid_: email (as a stored entity id), delivery

**Draft**:
An outbound message with send status `draft` that has not been sent yet.
_Avoid_: compose session, unsent email

**Folder**:
A thread's placement in the mailbox UI (`inbox`, `sent`, `drafts`, `archived`, `trash`, `spam`).
_Avoid_: label, category

**Label**:
A user-defined tag applied to a thread within one mailbox.
_Avoid_: folder, category

**actualMailboxId**:
The mailbox that owns a stored message after routing (exact match, alias resolution, catch-all, or outbound send).
_Avoid_: primary mailbox, owner mailbox

**envelopeTo**:
The SMTP RCPT TO address the message was delivered to.
_Avoid_: to header, recipient

**matchedVia**:
How inbound routing resolved a message to a mailbox (`exact`, `alias`, `catch_all`, or `outbound` for sent mail).
_Avoid_: match type, routing reason

**Command**:
An HTTP action that performs email work (send, reply, archive) rather than CRUD on a static resource.
_Avoid_: operation, action endpoint

**Resource**:
A persistent entity exposed with conventional CRUD (domains, mailboxes, labels).
_Avoid_: entity, record

## Example dialogue

**Dev:** When a message arrives at `help@company.com` but that's an alias for `support@`, which mailbox owns it?

**Expert:** The **actualMailboxId** is `support` — the target **mailbox**. The **envelopeTo** stays `help@company.com` and **matchedVia** is `alias`.

**Dev:** If I trash a thread that was in **sent**, then restore it, where does it go?

**Expert:** Back to **sent** — we snapshot the **folder** before trash/spam/archive.

**Dev:** Is a **draft** a different table?

**Expert:** No. A **draft** is a **message** with outbound direction and `draft` send status. **GET /messages/:id** reads it like any other **message**; only mutations use the draft command paths.
