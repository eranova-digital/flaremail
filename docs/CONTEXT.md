# Email Platform

A Cloudflare Worker that receives inbound mail, stores messages in Postgres and R2, and exposes a versioned HTTP API for mailbox management and outbound operations.

## Language

**Domain**:
A registered internet domain the platform accepts mail for and can send from.
_Avoid_: zone, site

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

**Display name**:
How an **account** is shown to humans and in OIDC `name` claims. Formed from **first name** + **last name**.
_Avoid_: full name, username

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
A registered relying party (e.g. CRM X) allowed to use Flaremail as an SSO source. Registered and managed by the **intendant** or a **superadmin** only. V1 flows: Authorization Code with PKCE (user login), refresh tokens, and Client Credentials (machine-to-machine). Each client has its own service permissions configured at registration, independent of any **account**. Whether an **OIDC client** requires a **consent** screen is configured per client (`require_consent`, default on). User access tokens may call the Flaremail mail API when the authorize request includes the required scopes (e.g. `mail:read`, `mail:send`).
_Avoid_: OAuth app, SSO integration, application

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

**Draft**:
An outbound message with send status `draft` that has not been sent yet.
_Avoid_: compose session, unsent email

**Folder**:
A thread's placement in the mailbox UI (`inbox`, `sent`, `drafts`, `archived`, `trash`, `spam`).
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
Someone using Flaremail to manage platform **mailboxes** via the Worker API. An **operator** is an authenticated **account** acting through the web UI, an **API key**, or an OIDC session.
_Avoid_: user, admin account

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

## Example dialogue

**Dev:** When a message arrives at `help@company.com` but that's an alias for `support@`, which mailbox owns it?

**Expert:** The **actualMailboxId** is `support` — the target **mailbox**. The **envelopeTo** stays `help@company.com` and **matchedVia** is `alias`.

**Dev:** If I trash a thread that was in **sent**, then restore it, where does it go?

**Expert:** Back to **sent** — we snapshot the **folder** before trash/spam/archive.

**Dev:** Is a **draft** a different table?

**Expert:** No. A **draft** is a **message** with outbound direction and `draft` send status. **GET /messages/:id** reads it like any other **message**; only mutations use the draft command paths.

**Dev:** Is `patrick@acme.com` an **account** or a **mailbox**?

**Expert:** Both, but they're different concepts. `patrick@acme.com` is a **mailbox** — the address. The **account** is who logs in; its **primary mailbox** is `patrick@acme.com`. If Patrick also has access to `sales@acme.com`, that's a **mailbox grant**, not a second primary.

**Dev:** How does the **intendant** sign in if it has no **mailbox**?

**Expert:** With `email: "intendant"` and the generated deploy-time password — the string `intendant` is a reserved sign-in identifier, not an email address. The **intendant** manages **domains** and **accounts**, and can read/send from **system mailboxes** (e.g. `postmaster@`) but not from user inboxes.
