# Email Platform

Flaremail is self-hosted email on Cloudflare: a public **gate** serves the web app and proxies `/api/*` to a private **core** Worker that receives inbound mail, stores messages in Postgres and R2, and owns the HTTP API, crons, and bindings.

This file is a **glossary** only. Implementation and deploy steps live in the [CLI README](../apps/cli/README.md). Hard decisions live in [adr/](./adr/).

## Language

**Domain**:
A registered internet domain the platform accepts mail for and can send from. Distinct from the **gate hostname** (web/API front door).
_Avoid_: zone, site, gate hostname

**Gate hostname**:
The public host attached to the **gate** Worker (web UI + `/api` proxy). Not a Flaremail **Domain** record; may share a zone with mail **Domains** or live on a different host (e.g. `mail.acme.com` vs `acme.com`).
_Avoid_: Domain Y, web domain, app domain, front door domain

**Instance**:
One deployed FlareMail: a **core** Worker, a **gate** Worker, and the Cloudflare / database resources they bind. Distinct from a mail **Domain** (an **instance** may serve many **Domains**).
_Avoid_: deployment (as the product noun), environment, tenant, site

**Gate**:
The public edge Worker that serves the web SPA and proxies `/api/*` to **core**. Not the mail/API Worker.
_Avoid_: edge, CDN, frontend worker, web worker

**Core**:
The private Worker that owns email, the HTTP API, crons, and platform bindings (R2, Hyperdrive, Email Routing). Reached from the browser only via the **gate** proxy.
_Avoid_: worker (as the product name for this role), API worker, backend, Mode A

**Account**:
An authentication identity in the platform. Most **accounts** have exactly one **primary mailbox** that uniquely identifies them. An **account** may be granted access to additional **mailboxes** beyond its primary. The **intendant** is the sole exception: it has no **primary mailbox** and cannot hold **mailbox grants**.
_Avoid_: user, login, operator

**Intendant**:
The first **account** created at deploy time. Platform configuration and management — no **primary mailbox**, no **mailbox grants**, no SSO. Exactly one per instance; role cannot be assigned to another **account**; cannot be deleted. Signs in with the literal identifier `intendant` (not an email address) and a deploy-time generated password. Can **regenerate** its own password (new random secret — never user-chosen). Can register **domains**, assign **admins**, assign any **role** (including **superadmin**), and register **OIDC clients**. May read and send mail on all **system mailboxes** and all **shared mailboxes** across all **domains** (see [ADR-0006](./adr/0006-system-mailbox-access-by-role.md)); cannot access user **primary mailboxes**.
_Avoid_: root, superuser, system account

**Role**:
The single permission tier held by an **account**: `user`, `manager`, `admin`, or `superadmin`. Each **account** holds exactly one **role**; higher tiers implicitly include lower-tier capabilities (e.g. an **admin** can use mail normally without a separate `user` **role**). The **intendant** is not a **role** — it is a unique bootstrap **account** outside this ladder.
_Avoid_: permission, group, access level

**Superadmin**:
A platform-wide **role** assignable to an **account** by the **intendant** only. Same platform-management permissions as the **intendant** except cannot assign the **superadmin** **role**. Can register **domains**, assign **admins**, assign `user`/`manager`/`admin` **roles**, and register **OIDC clients**. The **account** has a normal **primary mailbox**. No **domain assignment**. Mail scope is the **primary mailbox** plus all **shared mailboxes** on the instance (never other users' **primary mailboxes**).
_Avoid_: root admin, global admin

**Admin**:
A **role** with one or more **domain assignments**. Within those **domains**, has full management powers (mailboxes, accounts, configuration) but cannot register new **domains**. Creates **shared mailboxes** and assigns **managers** to them. Can assign `user` and `manager` **roles** within their **domain assignments**. Assigned to a **domain** by an **intendant** or **superadmin**. Mail scope is the **primary mailbox** plus all **shared mailboxes** on assigned **domains**; management APIs still cover all mailboxes on those **domains**.
_Avoid_: domain owner, domain admin

**Manager**:
A **role** with one or more **domain assignments**, plus **shared mailbox assignments** within those **domains**. Can **invite** (always as `user`) and suspend **accounts** within assigned **domains**, and manage membership on assigned **shared mailboxes**. Cannot change **roles**, create or delete mailboxes, or permanently remove **accounts** (**account removal** is **admin**-only). Cannot register **domains**. Mail scope is the **primary mailbox** plus **shared mailboxes** they are assigned to manage.
_Avoid_: team lead, supervisor

**User**:
The default **role**. Can access their **primary mailbox** and any **mailbox grants**. No administrative capabilities.
_Avoid_: member, regular account

**Shared mailbox assignment**:
The link between a **manager** and the **shared mailboxes** they may manage membership on. An **admin** assigns specific shared mailboxes (e.g. `sales@acme.com`, `pr@acme.com`) or a domain-wide wildcard (`*`) that automatically includes all current and future **shared mailboxes** in that **domain**.
_Avoid_: delegation, shared mailbox scope

**Domain assignment**:
The link between a scoped role (**admin** or **manager**) and the **domain**(s) they may operate on. Created by an **intendant** or **superadmin**.
_Avoid_: tenant, scope, permission set

**Primary mailbox**:
The one **mailbox** that uniquely identifies an **account**. Every **account** has exactly one; it is how the person is known in email (e.g. `patrick@acme.com`).
_Avoid_: actualMailboxId, owner mailbox

**Mailbox grant**:
Access an **account** holds to a **mailbox** other than its **primary mailbox** (e.g. a shared **mailbox** like `sales@acme.com`).
_Avoid_: delegation, permission, membership

**Identity**:
A send persona: a **name pattern** plus optional **signature**. Most are owned by a **mailbox**; a **default identity** is instance-scoped and live-linked (not copied per mailbox). Never changes the From address — that is always the **mailbox** being sent from. Distinct from **account** (authentication). An **account** selects among **identities** it is allowed to use; it does not own them.
_Avoid_: user identity, account identity, persona, alias (as the entity), send-as

**Name pattern**:
The rule on an **identity** that produces the **From name** (e.g. none, `{first_name}`, `{first_initial} {last_name}`, or a **custom name**). Not the account **display name**. Profile-based segments resolve from the sending **account**'s **profile fields** at send time; missing segments are omitted.
_Avoid_: display name (for this field), from template

**Custom name**:
A free-form **name pattern** value (literal From phrase). Gated by instance-wide **custom name allowance** for **user**- and **manager**-created **identities**; **admin**+ and the **intendant** may always use **custom name**.
_Avoid_: freeform display name

**Custom name allowance**:
Instance-wide Organization-tab setting: when off, **user** and **manager** actors cannot choose **custom name** on **identities** they create or edit. Does not constrain **admin**, **superadmin**, or **intendant**. Default: off.
_Avoid_: allow custom display names

**From name**:
The resolved phrase in the SMTP From header when an **identity** is applied (e.g. `P. Borcean` in `P. Borcean <sales@acme.com>`). Empty when the **name pattern** is none.
_Avoid_: display name, sender name

**Signature**:
Optional rich text on an **identity**. When an **identity** is applied in compose, the **signature** is inserted as a dedicated non-editable composer block (tags already resolved) after new text and before any quoted thread. The sender may drag or remove that block. Tags: `{from_name}`, `{first_name}`, `{last_name}`, `{first_initial}`, `{last_initial}`, `{mailbox_address}`, `{primary_address}`; unknown tags left literal. No `{display_name}`.
_Avoid_: footer, disclaimer (unless that is all it contains)

**Personal identity allowance**:
Per-**shared mailbox** setting: when on, an **account** sending from that **mailbox** may also select **identities** owned by its **primary mailbox**. Default off.
_Avoid_: allow personal from, borrow personal identity

**Identity export**:
Per-**shared mailbox** setting: when on, **identities** owned by that **mailbox** may be selected when sending from other **mailboxes** the **account** can access. Default off.
_Avoid_: allow identities elsewhere, identity portability, cross-mailbox identity

**Identity self-serve**:
Instance-wide setting (Organization tab in management): when on, an **account** may create and modify **identities** on its **primary mailbox**. When off, only elevated roles manage those mailbox-owned **identities**; holders only select. Never allows editing a **default identity**. **Shared mailbox** **identities** are managed by **managers** with a **shared mailbox assignment** (or **admin**+ in scope), never by grant holders. **System mailbox** **identities** are managed by the **intendant** only. Default: on.
_Avoid_: user-managed identities, personal identity editing

**Default identity**:
The single instance-scoped **identity** template (Organization tab), live-linked — not stamped onto each **mailbox**. Offered only when sending from **primary mailboxes** (preselected when the **account** has no other preference). Not offered on **shared** or **system mailboxes**. Not editable or deletable by mailbox holders; only Organization-tab editors change it. Changes apply immediately everywhere it is offered. New instances ship with name pattern `{first_name} {last_name}` and an empty **signature**.
_Avoid_: stamped identity, seeded identity, system identity (ambiguous with system mailbox)

**Display name**:
How an **account** is shown to humans and in OIDC `name` claims. Formed from **first name** + **last name**.
_Avoid_: full name, username, from name, name pattern

**Profile field**:
A piece of **account** metadata. V1 fields: **first name**, **last name**, **recovery address** (optional), **address** (optional: country, county/state, city, address line 1, address line 2), **phone** (optional). Set at **invite** (optionally pre-filled by the inviter) and editable by the **account** holder unless **locked**. **Admin**+ can **lock** individual fields to prevent holder edits.
_Avoid_: user attribute, property

**Local part policy**:
Per-**domain** rule for the mailbox address local part (before `@`). An **admin** may leave it **unlocked** (inviter chooses freely) or **enforce a pattern** (e.g. `{first_name}.{last_name}`). **Admin**-created **invites** are pre-filled to the pattern but not constrained by it; **manager** **invites** must follow an enforced pattern.
_Avoid_: email format, naming convention

**Invite**:
How a normal **account** is created — by a **manager** or higher **role**, never by self-registration. Creates a dormant **account** and its **primary mailbox**; the invitee cannot sign in until they complete setup with an **invite code** and set a password. Inbound mail to the **primary mailbox** is accepted and stored during this period. The inviter chooses or pre-fills **profile fields** (any may be **locked**); the **domain** must be one they are assigned to administer. The local part follows the **local part policy** unless the inviter is an **admin** (pre-filled, not constrained). There is no email-verification step; the platform is the source of truth for addresses.
_Avoid_: signup, registration

**Invite code**:
A one-time code (format `XXXX-XXXX`) issued with an **invite**. The invitee uses it to set their password and activate the **account**. A **manager** may auto-send it to an external email (which becomes the **recovery address**), or communicate it out-of-band.
_Avoid_: activation link, signup token

**Password reset code**:
A one-time code issued by a **manager** or **admin** when an **account** has no **recovery address** and needs a forgotten password reset. Distinct from an **invite code**. Self-service password reset via **recovery address** is available only when one is set.
_Avoid_: recovery code, reset token

**Password change**:
A signed-in non-intendant **account** holder replacing their own password with a new user-chosen one, after proving the current password (and MFA when enabled). Distinct from forgotten-password reset (via **recovery address** or **password reset code**) and from **intendant** regenerate (random secret, never user-chosen).
_Avoid_: password update, password rotation, set password

**Recovery address**:
An external email address on an **account** (optional **profile field**), often set when the **invite code** is auto-sent. Enables self-service password reset. Not accepted at sign-in. Sign-in uses the **primary mailbox** address (or the reserved identifier `intendant`). Can be added later by **admin**+ if missing.
_Avoid_: backup email, secondary email, login email

**OIDC subject**:
The `sub` claim Flaremail issues to relying parties (e.g. CRM X). An opaque, stable **account** ID — never reused after **account removal**. The **primary mailbox** address is emitted separately as the `email` claim. The **intendant** is excluded from SSO.
_Avoid_: primary mailbox, email address

**Session**:
First-party authentication for the Flaremail web app. Separate from the OIDC IdP — **accounts** sign in via email/password (or `intendant`) and receive a session credential. Third-party relying parties (e.g. CRM X) use OIDC Authorization Code + PKCE instead.
_Avoid_: login, JWT, cookie

**OIDC client**:
A registered relying party (e.g. CRM X) allowed to use Flaremail as an SSO source. Registered and managed by the **intendant** or a **superadmin** only. V1 flows: Authorization Code with PKCE (user login), refresh tokens, and Client Credentials (machine-to-machine). Each client has its own service permissions configured at registration, independent of any **account**. Whether an **OIDC client** requires a **consent** screen is configured per client (`require_consent`, default on). Optional branding: a **client profile picture** and a **homescreen URL** (Cancel on consent). User access tokens may call the Flaremail mail API when the authorize request includes the required scopes (e.g. `mail:read`, `mail:send`).
_Avoid_: OAuth app, SSO integration, application

**Client profile picture**:
The logo/image shown for an **OIDC client** on consent and admin screens. Stored like **account** profile pictures; publicly readable so consent can display it without elevated auth.
_Avoid_: app icon, favicon, OAuth logo

**Homescreen URL**:
Optional URL on an **OIDC client** where the end user is sent if they cancel consent (not the OAuth `redirect_uri`, which is used for Allow/Deny protocol responses).
_Avoid_: cancel URL, homepage, client URI

**Consent**:
The end-user approval step during OIDC authorization where an **account** reviews and accepts the scopes an **OIDC client** is requesting. Shown when the client requires it and no covering **consent grant** exists yet (or requested scopes exceed a prior grant). Skipped entirely when the client does not require consent — no grant row is recorded in that case.
_Avoid_: permission prompt, OAuth approval, authorize screen

**Consent grant**:
The persisted record that an **account** has approved a set of scopes for a specific **OIDC client**. Used to skip re-prompting until the client asks for scopes beyond what was granted. Revocable by the **account** holder, or by an **intendant** / **superadmin**; revocation also invalidates refresh tokens for that account–client pair.
_Avoid_: authorization, permission, token grant

**Pending authorization**:
A short-lived server-side record of an in-flight OIDC Authorization Code request, created when the flow must pause for sign-in or **consent**. Identified by an opaque id passed to the web app; consumed when the code is issued or when it expires.
_Avoid_: OAuth state, login challenge, authorize session

**Suspended account**:
An **account** blocked from signing in and from all outbound actions (send, reply, forward). Inbound mail to its **primary mailbox** and any granted **mailboxes** continues to be received and stored. OIDC authorization is rejected immediately — relying parties cannot obtain new tokens.
_Avoid_: disabled, deactivated, locked

**Account removal**:
Permanent deletion of an **account** and its **primary mailbox**. Unshared message data owned only by that **primary mailbox** is hard-deleted; shared visibility is preserved per **hard delete** rules. All **mailbox grants** are revoked and the email address becomes available for reuse.
_Avoid_: deprovision, offboard

**Mailbox**:
An email address on a domain that can receive, store, and (when not an alias) send mail. Distinct from an **account** — a **mailbox** is an address; an **account** is who logs in.
_Avoid_: account, user, inbox

**System mailbox**:
A platform-managed **mailbox** auto-provisioned when a **domain** is created (`postmaster@`, `noreply@`, `abuse@`). Marked `isSystemManaged: true` in the API; cannot be edited or deleted. **Intendant** can access all **system mailboxes**; **admin** and **superadmin** see **shared mailboxes** on their scope but need the **intendant** (or explicit **mailbox grants** for other roles) for **system mailboxes**. In the web UI, alias system addresses (e.g. `abuse@`) are not shown in the mailbox switcher — use `postmaster@` for operational mail.
_Avoid_: postmaster mailbox, infrastructure mailbox

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

**Attachment**:
A file part of a **message** with disposition `attachment`. Distinct from an inline part (CID image, signature logo).
_Avoid_: inline image, file, part

**Search**:
Finding **messages** in the selected **mailbox** that match a **search query**. Never other **mailboxes**. Default scope is every **folder** except trash and spam. Distinct from browsing by **folder** or **label**.
_Avoid_: mail search, filter, thread search

**Search query**:
The string that drives **search**. Plain text and operators; juxtaposition and `&&` are AND, `||` is OR, `-` is NOT; parentheses group; quotes mark a phrase or a spaced operator value.
_Avoid_: filter string, q

**Search hit**:
A **message** that matches the message-level part of a **search query** (thread operators stripped). AND of message operators must hold on that same **message**. Operators that describe the **thread** (`in:`, `label:`, `is:read` / `is:unread` / `is:starred`) constrain the **search result**; they do not create hits.
_Avoid_: match, result (for the message)

**Search result**:
A **thread** that satisfies the query's thread-level operators and, when the query has a message-level part, contains one or more **search hits**. Shown once in the threadlist, with those hits grouped under it (no nested hits when the query is thread-only).
_Avoid_: hit, message result, conversation result

**BIMI logo**:
The brand mark for an external sending domain asserted via BIMI. Shown as a sender avatar only when the inbound **message** passes DMARC alignment for that domain and the **organizational domain** publishes an enforcing DMARC policy (`quarantine` or `reject`). Distinct from an **account** profile picture and from a **client profile picture**. Cached per publishing domain and shared across messages that resolve to it.
_Avoid_: favicon, profile picture, avatar (as the stored entity), sender icon

**BIMI domain**:
The external domain that published the BIMI assertion used for a **message**'s **BIMI logo** (aligned From domain or its **organizational domain**, whichever record was used). Stored on the **message** when eligible; absent when auth/policy fails or no assertion exists.
_Avoid_: Domain, sending domain (ambiguous), From domain (not always the same after walk-up)

**Draft**:
An outbound message with send status `draft` that has not been sent yet. The sidebar **Drafts** entry is a view of these messages, not a list of threads.
_Avoid_: compose session, unsent email

**Folder**:
A thread's placement in the mailbox UI (`inbox`, `sent`, `archived`, `trash`, `spam`). The value `drafts` is reserved for parking draft-only threads so they do not appear in inbox or sent; the UI Drafts entry lists draft **messages**, not threads in that folder.
_Avoid_: label, category

**Hard delete**:
A permanent removal of a resource and any private data that only remains meaningful through that resource. Shared message visibility for other **mailboxes** is preserved when ownership can move to another visible non-alias **mailbox**.
_Avoid_: soft delete, trash

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

**API key**:
A long-lived credential any **account** can create and manage for non-interactive API access. Scoped to that **account** — carries exactly the permissions of its holder's **role** and assignments, no more.
_Avoid_: bearer token, personal access token, service token

**Operator**:
Someone who runs or uses a Flaremail instance. Includes authenticated **accounts** acting through the web UI, an **API key**, or an OIDC session, and the person who deploys/configures the instance.
_Avoid_: user, admin account

**Installing operator**:
The **operator** who deploys and configures a FlareMail **instance** (Cloudflare, Neon, **gate hostname**, Email Routing) via the CLI. Not necessarily a signed-in **account** yet.
_Avoid_: IT person, self-hoster, deployer, sysadmin (as the product term)

**Domain readiness**:
Advisory health of a **domain**'s mail configuration and flow (DNS checks and a loop email). Does not affect whether mail is accepted or sent.
_Avoid_: routing status, domain health (ambiguous)

**Domain readiness badge**:
Derived summary of the latest **domain validation run**: `checking`, `fail`, `healthy`, or `unhealthy`.
_Avoid_: domain status, validation state

**Domain validation run**:
One execution of **domain readiness** checks for a **domain**, with per-check results and log events.
_Avoid_: health check job, verify pass

**Validation check**:
A single test within a **domain validation run** (e.g. MX exists, DMARC rua, loop send, loop receive).
_Avoid_: probe, diagnostic step

**Log**:
An append-only record that something happened in the platform or mail path — from critical security events to everyday product activity. Distinct from **domain validation** run output (which is check diagnostics, not this concept). Each **log** has an **importance**, a **type**, a **summary**, **refs**, optional **actor**, and optional **context**.
_Avoid_: audit entry, audit log, activity event, activity log, audit record

**Importance**:
An integer 0–10 on a **log** where lower values matter more to reviewers (0 = critical, e.g. failed intendant authentication; 10 = colloquial noise, e.g. an **account** opened a **thread**).
_Avoid_: level, severity, priority, verbosity

**Type** (of a **log**):
The subject-area bucket a **log** belongs to. Closed set: `auth`, `accounts`, `invites`, `mailboxes`, `mailing`, `threads`, `messages`, `identities`, `domains` (includes **domain readiness** actions), `settings`, `oidc`, `api-keys`. Distinct from **role** and from MIME/content types elsewhere in the product.
_Avoid_: category, facility, domain (for this axis), tag, domain-readiness (as its own type)

**Summary**:
The human-readable template string on a **log**, with placeholders for **refs** (e.g. `"{from} → {to}"`). Does not embed display names — those resolve at read time from **refs**. Distinct from an email **message**.
_Avoid_: message (for this field), template, body, text

**Refs**:
Typed entity pointers on a **log** that the UI resolves into rich, clickable display data. Closed kinds: `account`, `mailbox`, `thread`, `message`, `domain`, `identity`, `invite`, `oidc-client`, `api-key`, `external-address` (literal email string, no platform entity). Placeholder keys in the **summary** map 1:1 to **refs** keys.
_Avoid_: entities, links, mentions, payload

**Actor**:
The **account** that performed the action recorded by a **log**, when there is one. Absent for system, inbound, or external causes — those parties appear only in **refs**.
_Avoid_: user, operator (for this field), subject, performer

**Context**:
Optional non-entity metadata on a **log** for HTTP-caused actions. Closed fields: `ip`, `userAgent`, `method`, `path`. Absent for non-HTTP causes (e.g. inbound SMTP). Does not store request bodies or arbitrary headers.
_Avoid_: metadata, extras, payload, request info, requestId

**Logs enabled**:
Instance-wide Organization-tab setting: when off, the platform does not store new **logs**. Existing **logs** remain readable until **log retention** removes them. Default: on.
_Avoid_: audit enabled, activity logging

**Max importance stored**:
Instance-wide Organization-tab setting: only **logs** with **importance** ≤ this value (0–10) are stored. Default: 10 (store all **importance** values).
_Avoid_: importance floor, importance threshold, min severity

**Log retention**:
Instance-wide Organization-tab setting: how long **logs** are kept before deletion. Allowed values: 3, 7, 14, 30, 60, or 90 days. Default: 14.
_Avoid_: log TTL, audit retention

## Example dialogue

**Dev:** When a message arrives at `help@company.com` but that's an alias for `support@`, which mailbox owns it?

**Expert:** The **actualMailboxId** is `support` — the target **mailbox**. The **envelopeTo** stays `help@company.com` and **matchedVia** is `alias`.

**Dev:** If I trash a thread that was in **sent**, then restore it, where does it go?

**Expert:** Back to **sent** — we snapshot the **folder** before trash/spam/archive.

**Dev:** Is a **draft** a different table?

**Expert:** No. A **draft** is a **message** with outbound direction and `draft` send status. **GET /messages/:id** reads it like any other **message**; only mutations use the draft command paths. The Drafts sidebar lists those messages via **GET /messages/drafts**, not threads.

**Dev:** Is `patrick@acme.com` an **account** or a **mailbox**?

**Expert:** Both, but they're different concepts. `patrick@acme.com` is a **mailbox** — the address. The **account** is who logs in; its **primary mailbox** is `patrick@acme.com`. If Patrick also has access to `sales@acme.com`, that's a **mailbox grant**, not a second primary.

**Dev:** How does the **intendant** sign in if it has no **mailbox**?

**Expert:** With `email: "intendant"` and the generated deploy-time password — the string `intendant` is a reserved sign-in identifier, not an email address. The **intendant** manages **domains** and **accounts**, and can read/send from **system mailboxes** (e.g. `postmaster@`) but not from user inboxes.
