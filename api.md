# Email Platform API (v1)

Human-readable reference for the HTTP API exposed by this worker.

Machine-readable spec:

- **OpenAPI 3.1 (YAML):** [`openapi.yaml`](./apps/worker/openapi.yaml)
- **OpenAPI 3.1 (JSON, live):** `GET /api/v1/openapi.json` (no auth)

## Base URL

All versioned endpoints are under:

```
/api/v1
```

Unversioned:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Liveness check |
| GET | `/api/v1/openapi.json` | No | OpenAPI document |

## Authentication

Protected endpoints require a Bearer token:

```
Authorization: Bearer <API_BEARER_TOKEN>
```

Configure `API_BEARER_TOKEN` in `apps/worker/.env` for local dev and via `wrangler secret put API_BEARER_TOKEN` for deployed Workers (`secrets.required` in `wrangler.jsonc`).

## Errors (RFC 9457)

All error responses use **Problem Details** ([RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)):

- **Content-Type:** `application/problem+json`
- **Body fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | URI reference identifying the problem type, e.g. `/api/v1/problems/validation-error` |
| `title` | Yes | Short summary for the HTTP status |
| `status` | Yes | HTTP status code (duplicate of response status) |
| `detail` | Yes | Human-readable explanation of this occurrence |
| `instance` | No | URI reference for this request, e.g. `/api/v1/threads` |
| `code` | No | Stable application error code (extension member) |

Example (400 validation):

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

Example (401):

```json
{
  "type": "/api/v1/problems/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Invalid bearer token",
  "instance": "/api/v1/domains",
  "code": "unauthorized"
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
| `not-found` | 404 | Resource not found |
| `content-too-large` | 413 | Message or headers too large (email send) |
| `rate-limit-exceeded` | 429 | Send rate limit hit |
| `internal-error` | 500 | Unexpected server error |

Successful responses use `application/json` unless noted (attachment download uses the attachment MIME type).

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

## Resources

### Domains

| Method | Path | Description |
|--------|------|-------------|
| GET | `/domains` | List all domains |
| POST | `/domains` | Create domain |
| GET | `/domains/:id` | Get domain |
| PATCH | `/domains/:id` | Update (`isActive`, `catchAllEnabled`, `catchAllMailboxId`) |
| DELETE | `/domains/:id` | Hard delete (cascades mailboxes, messages, R2) |

**Create body:**

```json
{ "domain": "example.com" }
```

**Response:** `{ id, domain, isActive, catchAllEnabled, catchAllMailboxId }`

No `verified` field — use `isActive` only.

### Mailboxes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/mailboxes` | List mailboxes |
| POST | `/mailboxes` | Create mailbox |
| GET | `/mailboxes/:id` | Get mailbox |
| PATCH | `/mailboxes/:id` | Update (`isActive`) |
| DELETE | `/mailboxes/:id` | Hard delete (cascades messages, R2) |

**Create body:**

```json
{
  "address": "support@example.com",
  "domainId": "uuid",
  "type": "shared",
  "aliasTargetId": "uuid"
}
```

`aliasTargetId` is **required** when `type` is `alias`. Aliases cannot send mail.

### Labels (per mailbox)

| Method | Path |
|--------|------|
| GET | `/mailboxes/:mailboxId/labels` |
| POST | `/mailboxes/:mailboxId/labels` |
| GET | `/mailboxes/:mailboxId/labels/:id` |
| PATCH | `/mailboxes/:mailboxId/labels/:id` |
| DELETE | `/mailboxes/:mailboxId/labels/:id` |

### Attachments (inbound only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/attachments/:id` | Download bytes (inbound messages only) |

No upload or outbound attachment APIs in v1.

### Deletion matrix

Hard deletes preserve database integrity first. R2 object deletion runs after the database delete and is best-effort.

| Delete target | Deleted | Preserved / reassigned | Blocked when |
|---------------|---------|------------------------|--------------|
| Domain | The domain, its mailboxes, dependent aliases in any domain, labels, private messages, attachments, and DB visibility rows | Messages also visible to remaining non-alias mailboxes move `actualMailboxId` to the oldest remaining visible non-alias mailbox | — |
| Mailbox | The mailbox, aliases that target it, labels, private messages, attachments, and DB visibility rows | Messages also visible to remaining non-alias mailboxes move `actualMailboxId` to the oldest remaining visible non-alias mailbox. Messages that only referenced a deleted alias via `matchedMailboxId` keep `matchedVia`/`envelopeTo` history and clear `matchedMailboxId` | The mailbox or a dependent alias is an enabled domain catch-all target |
| Alias mailbox | The alias mailbox and its UI/visibility rows | Target-owned messages remain; `matchedMailboxId` is cleared while `matchedVia=alias` and `envelopeTo` remain as history | The alias is an enabled domain catch-all target |
| Draft | The draft message, attachments, and R2 objects | Other thread mailbox state is refreshed; empty draft-only threads are removed | — |

## Messages

### Read

| Method | Path | Description |
|--------|------|-------------|
| GET | `/messages/:id?mailboxId=` | Full message — parses raw EML from R2 (`text`, `html`, `headers`, attachment metadata). Requires mailbox scope for visibility. |
| GET | `/messages/:id/preview?mailboxId=` | DB metadata only (fast; no R2). Requires mailbox scope for visibility. |

Works for inbound, sent, and **draft** messages.

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
  "html": "<p>HTML body</p>"
}
```

At least one of `text` or `html` is required. Text/HTML only — no attachments.

**Response (201):**

```json
{
  "id": "uuid",
  "rfcMessageId": "<...@domain>",
  "status": "sent"
}
```

## Drafts

| Method | Path | Description |
|--------|------|-------------|
| POST | `/messages/drafts` | Create draft |
| PATCH | `/messages/drafts/:id` | Update draft |
| DELETE | `/messages/drafts/:id` | Delete draft |
| POST | `/messages/drafts/:id/send` | Send draft |

Create body matches send, plus optional `threadId` / `inReplyToMessageId` for reply drafts. **`mailboxId` is required** in the body.

## Reply

```
POST /messages/:id/reply
```

**Body:**

```json
{
  "mailboxId": "uuid",
  "text": "Thanks!",
  "html": "<p>Thanks!</p>",
  "replyAll": false
}
```

The server resolves recipients from the parent message (including **Reply-To** from stored EML). Override with optional `to`, `cc`, `bcc`.

**Response (201):** same shape as send (`id`, `rfcMessageId`, `status`).

## Threads

All thread reads require **`?mailboxId=`** (404 if the thread is not linked to that mailbox).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/threads?mailboxId=&folder=&cursor=&limit=` | List threads (`folder` optional — omit for all folders) |
| GET | `/threads/:id?mailboxId=` | Get thread metadata |
| GET | `/threads/:id/messages?mailboxId=` | Messages in thread (preview DTOs, chronological) |
| PATCH | `/threads/:id?mailboxId=` | Replace labels: `{ "labelIds": ["uuid", ...] }` |

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

Minimal v1 search: free-text `ILIKE` on `subject`, `textBody`, `from`, `to` within the mailbox. Returns **message hits** with `threadId` and cursor pagination.

## Inbound email

Inbound mail is **not** exposed over HTTP. Cloudflare Email Routing invokes the Worker's `email()` handler directly.

## Domain glossary

See [`CONTEXT.md`](./CONTEXT.md) for canonical terms (Domain, Mailbox, Thread, Message, Draft, etc.).
