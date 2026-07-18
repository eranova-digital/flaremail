# Flaremail API (v1)

Human-readable reference for the HTTP API exposed by the Worker.

**Machine-readable spec:**

- OpenAPI 3.1 (YAML): [`apps/worker/openapi.yaml`](./apps/worker/openapi.yaml)
- OpenAPI 3.1 (JSON, live): `GET /api/v1/openapi.json` (no auth)

**Domain terms:** [`CONTEXT.md`](./CONTEXT.md)

---

## Base URL

Versioned endpoints:

```
/api/v1
```

Unversioned:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Liveness check |
| GET | `/api/v1/openapi.json` | No | OpenAPI document |

---

## Authentication

Protected endpoints require either a signed-in web session or an API key in the
`Authorization` header:

```
Authorization: Bearer <api-key>
```

API key format:

- API keys start with `fmu_`

### API keys

Create and revoke them from the web app under `/settings?tab=security`.

- They are tied to one account.
- Effective access is the intersection of:
  - the account's normal role/mailbox access
  - the scopes selected on the key

Profile scopes (`profile:*`, `profile_picture:*`) cover name, address, phone, and
profile picture changes for the key holder. Security operations — recovery email,
sessions, API keys, MFA, and passkeys — are session-only and cannot be granted to
API keys.

Example:

```bash
curl \
  -H "Authorization: Bearer fmu_xxx" \
  "https://your-host/api/v1/threads?mailboxId=<mailbox-uuid>"
```

### Managing keys over HTTP

API key endpoints require a signed-in session:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api-keys` | List your API keys and grantable scopes |
| POST | `/api-keys` | Create an API key |
| DELETE | `/api-keys/:id` | Revoke one of your API keys |

---

## Errors (RFC 9457)

All error responses use **Problem Details** ([RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)):

- **Content-Type:** `application/problem+json`

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | URI reference, e.g. `/api/v1/problems/validation-error` |
| `title` | Yes | Short summary for the HTTP status |
| `status` | Yes | HTTP status code |
| `detail` | Yes | Human-readable explanation |
| `instance` | No | Request path, e.g. `/api/v1/threads` |
| `code` | No | Stable application error code |

Example (400):

```json
{
  "type": "/api/v1/problems/validation-error",
  "title": "Bad Request",
  "status": 400,
  "detail": "Field 'mailboxId' is required",
  "instance": "/api/v1/messages/send",
  "code": "validation-error"
}
```

Common `code` values:

| code | HTTP | Meaning |
|------|------|---------|
| `validation-error` | 400 | Invalid or missing request fields |
| `invalid-json` | 400 | Body is not valid JSON |
| `missing-query-parameter` | 400 | Required query param missing |
| `bad-request` | 400 | General client error |
| `unauthorized` | 401 | Missing or invalid Bearer token |
| `forbidden` | 403 | Authenticated but not permitted for this action or mailbox |
| `not-found` | 404 | Resource not found |
| `content-too-large` | 413 | Message, headers, or attachments too large |
| `rate-limit-exceeded` | 429 | Cloudflare Email Sending rate/daily limit |
| `internal-error` | 500 | Unexpected server error |

Successful responses use `application/json` unless noted (raw EML and attachment downloads use binary MIME types).

---

## Pagination

List endpoints use **cursor pagination**:

| Query | Default | Max |
|-------|---------|-----|
| `limit` | 50 | 100 |
| `cursor` | — | Opaque cursor from previous `nextCursor` |

Response shape:

```json
{
  "items": [ ... ],
  "nextCursor": "..."
}
```

`nextCursor` is `null` when there are no more pages.

---

## Domains

| Method | Path | Description |
|--------|------|-------------|
| GET | `/domains` | List all domains |
| POST | `/domains` | Create domain (auto-provisions system mailboxes) |
| GET | `/domains/:id` | Get domain |
| PATCH | `/domains/:id` | Update `isActive`, `catchAllEnabled`, `catchAllMailboxId` |
| DELETE | `/domains/:id` | Hard delete (cascades mailboxes, messages, R2) |

**Create body:**

```json
{ "domain": "example.com" }
```

**Domain response** includes routing fields and a `readiness` summary:

```json
{
  "id": "uuid",
  "domain": "example.com",
  "isActive": true,
  "catchAllEnabled": false,
  "catchAllMailboxId": null,
  "readiness": {
    "badge": "healthy",
    "latestRunId": "uuid",
    "latestRunStartedAt": "2026-07-09T10:00:00.000Z",
    "latestRunFinishedAt": "2026-07-09T10:05:00.000Z"
  }
}
```

`readiness.badge` is `checking`, `fail`, `healthy`, `unhealthy`, or `null` (no run yet). Readiness is **advisory** — it does not gate mail acceptance or sending.

Creating a domain provisions system mailboxes: `postmaster@` (system), `noreply@` (blackhole), `abuse@` (alias → postmaster). These cannot be edited or deleted (`isSystemManaged: true`).

### Domain validation runs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/domains/:id/validation-runs` | List validation run history |
| POST | `/domains/:id/validation-runs` | Start a new run, or return the active one |
| GET | `/domains/:id/validation-runs/:runId` | Run detail with checks and log events |

**Checks** (per run):

| `checkKey` | Tier | What it tests |
|------------|------|---------------|
| `mx` | critical | MX records exist for the domain |
| `loop_send` | critical | Send from `noreply@` to `postmaster@` via Email Sending |
| `loop_receive` | critical | Receive loop mail at `postmaster@` (10-minute deadline) |
| `dmarc_rua` | advisory | DMARC `rua` contains `mailto:postmaster@<domain>` |

**Badge derivation:** `checking` while running; `fail` if any critical check fails; `healthy` if all pass; `unhealthy` if critical pass but advisory fails.

Loop validation emails carry a per-run token and are **consumed** by the inbound handler — they are not stored as mailbox messages. Receive timeouts are processed by the Worker cron (`*/2 * * * *`).

---

## Mailboxes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/mailboxes` | List mailboxes |
| POST | `/mailboxes` | Create mailbox |
| GET | `/mailboxes/:id` | Get mailbox |
| PATCH | `/mailboxes/:id` | Update `isActive` |
| DELETE | `/mailboxes/:id` | Hard delete (cascades messages, R2) |

**Types** (create accepts `primary`, `secondary`, `shared`, `alias` only):

| Type | Receives | Sends | Notes |
|------|----------|-------|-------|
| `primary` | Yes | Yes | |
| `secondary` | Yes | Yes | |
| `shared` | Yes | Yes | |
| `alias` | Forwards inbound | No | Requires target |
| `system` | Yes | Yes | Auto-provisioned; immutable |
| `blackhole` | No | Yes | Auto-provisioned `noreply@`; outbound only |

**Create body:**

```json
{
  "address": "support@example.com",
  "domainId": "uuid",
  "type": "shared",
  "aliasTargetId": "uuid"
}
```

For `type: "alias"`, provide **either** `aliasTargetId` (UUID of a receiving mailbox) **or** `aliasTargetAddress` (email string) — not both. Aliases cannot send mail.

**Response:** `{ id, domainId, address, type, aliasTargetId, aliasTargetAddress, isActive, isSystemManaged }`

### Mailbox access

Which mailboxes a principal sees in `GET /mailboxes` and may use on mail APIs (`threads`, `messages`, `labels`, `search`, send/draft) depends on **role** and assignments. See [ADR-0006](./adr/0006-system-mailbox-access-by-role.md).

| Role | Visible mailboxes | Mail read/send |
|------|-------------------|----------------|
| `user` | **Primary mailbox** + **mailbox grants** (shared only) | Same set |
| `manager` | **Primary mailbox** + assigned **shared mailboxes** | Same set |
| `admin` | **Primary mailbox** + all **shared mailboxes** on assigned **domains** | Same set |
| `superadmin` | **Primary mailbox** + all **shared mailboxes** on the instance | Same set |
| `intendant` | All **system mailboxes** + all **shared mailboxes** | Same set |

Mail endpoints require `mailboxId` (query param or body). Requests for a mailbox outside the principal's scope return **403** (`code: forbidden`).

**System mailboxes** are auto-provisioned per domain: `postmaster@` (`system`), `noreply@` (`blackhole`), `abuse@` (alias → postmaster). They cannot be edited or deleted.

---

## Labels (per mailbox)

| Method | Path |
|--------|------|
| GET | `/mailboxes/:mailboxId/labels` |
| POST | `/mailboxes/:mailboxId/labels` |
| GET | `/mailboxes/:mailboxId/labels/:id` |
| PATCH | `/mailboxes/:mailboxId/labels/:id` |
| DELETE | `/mailboxes/:mailboxId/labels/:id` |

---

## Email templates

Reusable HTML templates stored in R2 under `templates/{id}.html`. Global templates (`mailboxId` null) are available on every mailbox; mailbox templates only for that mailbox.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/templates?mailboxId=` | Templates available when composing from that mailbox (global + mailbox) |
| GET | `/templates?manage=1` | Templates the principal can manage |
| POST | `/templates` | Multipart create (`name`, `file`, optional `mailboxId`) |
| GET | `/templates/:id` | Template metadata |
| GET | `/templates/:id/content?mailboxId=` | Raw HTML body |
| PATCH | `/templates/:id` | Rename (`{ name }`) |
| DELETE | `/templates/:id` | Delete metadata + R2 object |

**Permissions:** Superadmins/admins create global and mailbox templates. Managers create mailbox templates on mailboxes they manage. Compose listing requires read access to the mailbox.

### System templates

Custom HTML for instance transactional emails. Available to the intendant (and superadmins when organization tab access allows). Unconfigured keys fall back to built-in plain text.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/system-templates` | Catalog of system email types + configured status + tags |
| PUT | `/system-templates/:key` | Multipart upload (`file`) for `invite`, `password_reset`, `recovery_verify`, or `mfa_disable` |
| GET | `/system-templates/:key/content` | Raw HTML body |
| DELETE | `/system-templates/:key` | Revert to built-in plain text |

**Tags** (replaced at send time): `{invite_code}` / `{reset_code}` / `{verification_code}`, `{code}` (alias), `{expires_in}`.

---

## Messages

### Read

| Method | Path | Description |
|--------|------|-------------|
| GET | `/messages/:id?mailboxId=` | Full message — parses raw EML from R2 (`text`, `html`, `headers`, attachment metadata) |
| GET | `/messages/:id/preview?mailboxId=` | DB metadata only (fast; no R2) |
| GET | `/messages/:id/raw?mailboxId=` | Download raw `.eml` bytes (`message/rfc822`) |

All read endpoints require `mailboxId` for visibility scoping. Works for inbound, sent, and draft messages.

### Send

```
POST /messages/send
```

**Body:**

```json
{
  "mailboxId": "uuid",
  "to": ["recipient@example.com"],
  "cc": [],
  "bcc": [],
  "subject": "Hello",
  "text": "Plain text body",
  "html": "<p>HTML body</p>",
  "attachments": [
    {
      "filename": "doc.pdf",
      "mimeType": "application/pdf",
      "content": "<base64>",
      "disposition": "attachment"
    }
  ]
}
```

At least one of `text` or `html` is required. `to` entries may be plain strings or `{ "email": "...", "name": "..." }` objects.

**Response (201):**

```json
{
  "id": "uuid",
  "rfcMessageId": "<...@domain>",
  "status": "sent"
}
```

### Reply

```
POST /messages/:id/reply
```

**Body:**

```json
{
  "mailboxId": "uuid",
  "text": "Thanks!",
  "html": "<p>Thanks!</p>",
  "replyAll": false,
  "attachments": []
}
```

The server resolves recipients from the parent message (including **Reply-To** from stored EML). Override with optional `to`, `cc`, `bcc`, `subject`. Optional `attachments` use the same shape as send.

**Response (201):** same as send.

### Forward

```
POST /messages/:id/forward
```

**Body:**

```json
{
  "mailboxId": "uuid",
  "to": ["colleague@example.com"],
  "text": "See below",
  "includeAttachments": true,
  "includeQuotedBody": true
}
```

`to` is required. `includeAttachments` (default `true`) copies inbound attachments from the parent. `includeQuotedBody` (default `true`) appends a quoted copy of the parent below your text/html.

**Response (201):** same as send.

---

## Drafts

| Method | Path | Description |
|--------|------|-------------|
| POST | `/messages/drafts` | Create draft |
| PATCH | `/messages/drafts/:id` | Update draft |
| DELETE | `/messages/drafts/:id` | Delete draft |
| POST | `/messages/drafts/:id/send` | Send draft |

Create/update body matches send, plus optional:

| Field | Purpose |
|-------|---------|
| `threadId` | Attach draft to an existing thread |
| `inReplyToMessageId` | Reply-draft threading |
| `replyAll` | When creating a reply draft without explicit `to`, include all visible thread participants except the sending mailbox |

**`mailboxId` is required** in create body.

---

## Threads

All thread reads and mutations require **`?mailboxId=`** (404 if the thread is not linked to that mailbox).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/threads?mailboxId=&folder=&labelId=&cursor=&limit=` | List threads |
| GET | `/threads/:id?mailboxId=` | Get thread metadata |
| GET | `/threads/:id/messages?mailboxId=` | Messages in thread (preview DTOs, chronological) |
| PATCH | `/threads/:id?mailboxId=` | Replace labels: `{ "labelIds": ["uuid", ...] }` |

**`folder`** (optional): `inbox`, `sent`, `drafts`, `archived`, `trash`, `spam` — omit for all folders.

**`labelId`** (optional): filter to threads with that label.

### Thread commands

```
POST /threads/:id/{action}?mailboxId=
```

| action | Effect |
|--------|--------|
| `archive` | Move to archived |
| `trash` | Move to trash |
| `spam` | Move to spam |
| `restore` | Restore to folder snapshotted before trash/spam/archive |
| `mark-read` | Set read |
| `mark-unread` | Set unread |
| `star` | Star thread |
| `unstar` | Unstar thread |

Returns updated thread JSON.

---

## Search

```
POST /search
```

**Body:**

```json
{
  "mailboxId": "uuid",
  "query": "invoice",
  "cursor": null,
  "limit": 50
}
```

v1 search: free-text `ILIKE` on `subject`, `textBody`, `from`, `to` within the mailbox. Returns **message hits** with `threadId` and cursor pagination.

---

## Attachments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/attachments/:id` | Download inbound attachment bytes |

Outbound attachments are embedded in send/reply/forward/draft bodies (base64) — there is no separate upload endpoint.

---

## Deletion matrix

Hard deletes preserve database integrity first. R2 object deletion runs after the database delete and is best-effort.

| Delete target | Deleted | Preserved / reassigned | Blocked when |
|---------------|---------|------------------------|--------------|
| Domain | Domain, mailboxes, aliases, labels, private messages, attachments, visibility rows | Messages visible to other mailboxes move `actualMailboxId` to the oldest remaining non-alias mailbox | — |
| Mailbox | Mailbox, dependent aliases, labels, private messages, attachments, visibility rows | Shared messages reassigned; alias `matchedMailboxId` cleared on history rows | Mailbox or dependent alias is an enabled catch-all target |
| Alias mailbox | Alias and its visibility rows | Target-owned messages remain; `matchedMailboxId` cleared, `matchedVia`/`envelopeTo` kept as history | Alias is an enabled catch-all target |
| Draft | Draft message, attachments, R2 objects | Thread state refreshed; empty draft-only threads removed | — |
| System mailbox | — | — | Always blocked (`isSystemManaged`) |

---

## Inbound email

Inbound mail is **not** exposed over HTTP. Cloudflare Email Routing invokes the Worker's `email()` handler directly.

**Routing resolution** (in order):

1. Exact mailbox address match
2. Alias → forward to target (CF `message.forward`) or store on target mailbox
3. Domain catch-all (when `catchAllEnabled` and `catchAllMailboxId` set)
4. `blackhole` addresses (`noreply@`) → SMTP reject (`Unknown recipient`)
5. No match and no catch-all → SMTP reject

Validation loop messages are consumed before normal routing.

---

## Email address format

Throughout outbound bodies, addresses accept either:

```json
"user@example.com"
```

or:

```json
{ "email": "user@example.com", "name": "User Name" }
```
