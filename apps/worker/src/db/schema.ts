import {
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const mailboxTypeEnum = pgEnum("mailbox_type", [
	"primary",
	"secondary",
	"shared",
	"alias",
	"system",
	"blackhole",
]);
export const matchedViaEnum = pgEnum("matched_via", [
	"exact",
	"alias",
	"catch_all",
	"outbound",
]);
export const messageDirectionEnum = pgEnum("message_direction", [
	"inbound",
	"outbound",
]);
export const sendStatusEnum = pgEnum("send_status", [
	"draft",
	"sending",
	"sent",
	"failed",
]);
export const threadFolderEnum = pgEnum("thread_folder", [
	"inbox",
	"spam",
	"trash",
	"archived",
	"drafts",
	"sent",
]);

export const domainReadinessBadgeEnum = pgEnum("domain_readiness_badge", [
	"checking",
	"fail",
	"healthy",
	"unhealthy",
]);
export const domainValidationRunStatusEnum = pgEnum(
	"domain_validation_run_status",
	["checking", "completed"],
);
export const validationCheckKeyEnum = pgEnum("validation_check_key", [
	"mx",
	"dmarc_rua",
	"loop_send",
	"loop_receive",
]);
export const validationCheckStatusEnum = pgEnum("validation_check_status", [
	"pending",
	"passed",
	"failed",
	"skipped",
]);
export const validationCheckTierEnum = pgEnum("validation_check_tier", [
	"critical",
	"advisory",
]);
export const validationLogLevelEnum = pgEnum("validation_log_level", [
	"info",
	"warning",
	"error",
]);
export const validationLogStageEnum = pgEnum("validation_log_stage", [
	"dns",
	"send",
	"receive",
	"summary",
]);

export const domains = pgTable("domains", {
	id: uuid("id").primaryKey(),
	name: text("name").notNull().unique(),
	catchAllEnabled: boolean("catch_all_enabled").notNull().default(false),
	catchAllMailboxId: uuid("catch_all_mailbox_id"),
	isActive: boolean("is_active").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const mailboxes = pgTable(
	"mailboxes",
	{
		id: uuid("id").primaryKey(),
		domainId: uuid("domain_id")
			.notNull()
			.references(() => domains.id),
		localPart: text("local_part").notNull(),
		address: text("address").notNull().unique(),
		type: mailboxTypeEnum("type").notNull(),
		aliasTargetId: uuid("alias_target_id"),
		aliasTargetAddress: text("alias_target_address"),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("mailboxes_domain_id_local_part_idx").on(
			table.domainId,
			table.localPart,
		),
		index("mailboxes_address_idx").on(table.address),
		index("mailboxes_alias_target_id_idx").on(table.aliasTargetId),
	],
);

export const threads = pgTable(
	"threads",
	{
		id: uuid("id").primaryKey(),
		subject: text("subject"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("threads_updated_at_idx").on(table.updatedAt)],
);

export const threadMailboxes = pgTable(
	"thread_mailboxes",
	{
		threadId: uuid("thread_id")
			.notNull()
			.references(() => threads.id, { onDelete: "cascade" }),
		mailboxId: uuid("mailbox_id")
			.notNull()
			.references(() => mailboxes.id, { onDelete: "cascade" }),
		preview: varchar("preview", { length: 200 }),
		lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull(),
		messageCount: integer("message_count").notNull().default(0),
		isRead: boolean("is_read").notNull().default(false),
		isStarred: boolean("is_starred").notNull().default(false),
		folder: threadFolderEnum("folder").notNull().default("inbox"),
		restoreFolder: threadFolderEnum("restore_folder"),
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		trashedAt: timestamp("trashed_at", { withTimezone: true }),
		markedAsSpamAt: timestamp("marked_as_spam_at", { withTimezone: true }),
	},
	(table) => [
		primaryKey({ columns: [table.threadId, table.mailboxId] }),
		index("thread_mailboxes_mailbox_id_idx").on(table.mailboxId),
		index("thread_mailboxes_mailbox_id_folder_last_message_at_idx").on(
			table.mailboxId,
			table.folder,
			table.lastMessageAt,
		),
		index("thread_mailboxes_mailbox_id_last_message_at_idx").on(
			table.mailboxId,
			table.lastMessageAt,
		),
	],
);

export const labels = pgTable(
	"labels",
	{
		id: uuid("id").primaryKey(),
		mailboxId: uuid("mailbox_id")
			.notNull()
			.references(() => mailboxes.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		color: text("color"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("labels_mailbox_id_name_idx").on(table.mailboxId, table.name),
	],
);

export const threadLabels = pgTable(
	"thread_labels",
	{
		threadId: uuid("thread_id")
			.notNull()
			.references(() => threads.id, { onDelete: "cascade" }),
		labelId: uuid("label_id")
			.notNull()
			.references(() => labels.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.threadId, table.labelId] }),
		index("thread_labels_label_id_idx").on(table.labelId),
	],
);

export const messages = pgTable(
	"messages",
	{
		id: uuid("id").primaryKey(),
		threadId: uuid("thread_id")
			.notNull()
			.references(() => threads.id),
		messageId: text("message_id").notNull().unique(),
		direction: messageDirectionEnum("direction").notNull().default("inbound"),
		sendStatus: sendStatusEnum("send_status"),
		inReplyTo: text("in_reply_to"),
		references: text("references").array(),
		from: text("from").notNull(),
		to: text("to").notNull(),
		envelopeTo: text("envelope_to").notNull(),
		actualMailboxId: uuid("actual_mailbox_id")
			.notNull()
			.references(() => mailboxes.id),
		matchedMailboxId: uuid("matched_mailbox_id").references(
			() => mailboxes.id,
			{ onDelete: "set null" },
		),
		matchedVia: matchedViaEnum("matched_via").notNull(),
		cc: text("cc"),
		bcc: text("bcc"),
		subject: text("subject"),
		textBody: text("text_body"),
		preview: varchar("preview", { length: 200 }),
		hasHtml: boolean("has_html").notNull(),
		hasAttachments: boolean("has_attachments").notNull(),
		sentAt: timestamp("sent_at", { withTimezone: true }),
		receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
		rawEmlKey: text("raw_eml_key").notNull(),
		sendErrorCode: text("send_error_code"),
		sendErrorMessage: text("send_error_message"),
		sentByAccountId: uuid("sent_by_account_id").references(() => accounts.id, {
			onDelete: "set null",
		}),
	},
	(table) => [
		index("messages_thread_id_received_at_idx").on(
			table.threadId,
			table.receivedAt,
		),
		index("messages_received_at_idx").on(table.receivedAt),
		index("messages_actual_mailbox_id_received_at_idx").on(
			table.actualMailboxId,
			table.receivedAt,
		),
		index("messages_sent_by_account_id_idx").on(table.sentByAccountId),
	],
);

export const messageSeenBy = pgTable(
	"message_seen_by",
	{
		messageId: uuid("message_id")
			.notNull()
			.references(() => messages.id, { onDelete: "cascade" }),
		mailboxId: uuid("mailbox_id")
			.notNull()
			.references(() => mailboxes.id, { onDelete: "cascade" }),
		accountId: uuid("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.messageId, table.mailboxId, table.accountId] }),
		index("message_seen_by_mailbox_id_message_id_idx").on(
			table.mailboxId,
			table.messageId,
		),
		index("message_seen_by_message_id_idx").on(table.messageId),
	],
);

export const messageMailboxes = pgTable(
	"message_mailboxes",
	{
		messageId: uuid("message_id")
			.notNull()
			.references(() => messages.id, { onDelete: "cascade" }),
		mailboxId: uuid("mailbox_id")
			.notNull()
			.references(() => mailboxes.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.messageId, table.mailboxId] }),
		index("message_mailboxes_mailbox_id_idx").on(table.mailboxId),
	],
);

export const attachments = pgTable(
	"attachments",
	{
		id: uuid("id").primaryKey(),
		messageId: uuid("message_id")
			.notNull()
			.references(() => messages.id, { onDelete: "cascade" }),
		filename: text("filename"),
		mimeType: text("mime_type").notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		disposition: text("disposition"),
		contentId: text("content_id"),
		storageKey: text("storage_key").notNull().unique(),
	},
	(table) => [index("attachments_message_id_idx").on(table.messageId)],
);

export const domainValidationRuns = pgTable(
	"domain_validation_runs",
	{
		id: uuid("id").primaryKey(),
		domainId: uuid("domain_id")
			.notNull()
			.references(() => domains.id, { onDelete: "cascade" }),
		status: domainValidationRunStatusEnum("status").notNull().default("checking"),
		badge: domainReadinessBadgeEnum("badge").notNull().default("checking"),
		token: text("token").notNull().unique(),
		receiveDeadlineAt: timestamp("receive_deadline_at", { withTimezone: true }),
		startedAt: timestamp("started_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		finishedAt: timestamp("finished_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("domain_validation_runs_domain_id_started_at_idx").on(
			table.domainId,
			table.startedAt,
		),
		index("domain_validation_runs_status_receive_deadline_at_idx").on(
			table.status,
			table.receiveDeadlineAt,
		),
	],
);

export const domainValidationChecks = pgTable(
	"domain_validation_checks",
	{
		id: uuid("id").primaryKey(),
		runId: uuid("run_id")
			.notNull()
			.references(() => domainValidationRuns.id, { onDelete: "cascade" }),
		checkKey: validationCheckKeyEnum("check_key").notNull(),
		tier: validationCheckTierEnum("tier").notNull(),
		status: validationCheckStatusEnum("status").notNull().default("pending"),
		code: text("code"),
		message: text("message"),
		checkedAt: timestamp("checked_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("domain_validation_checks_run_id_check_key_idx").on(
			table.runId,
			table.checkKey,
		),
		index("domain_validation_checks_run_id_idx").on(table.runId),
	],
);

export const domainValidationLogEvents = pgTable(
	"domain_validation_log_events",
	{
		id: uuid("id").primaryKey(),
		runId: uuid("run_id")
			.notNull()
			.references(() => domainValidationRuns.id, { onDelete: "cascade" }),
		level: validationLogLevelEnum("level").notNull(),
		stage: validationLogStageEnum("stage").notNull(),
		code: text("code"),
		message: text("message").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("domain_validation_log_events_run_id_created_at_idx").on(
			table.runId,
			table.createdAt,
		),
	],
);

export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
export type Mailbox = typeof mailboxes.$inferSelect;
export type NewMailbox = typeof mailboxes.$inferInsert;
export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;
export type ThreadMailbox = typeof threadMailboxes.$inferSelect;
export type NewThreadMailbox = typeof threadMailboxes.$inferInsert;
export type Label = typeof labels.$inferSelect;
export type NewLabel = typeof labels.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type MessageSeenBy = typeof messageSeenBy.$inferSelect;
export type NewMessageSeenBy = typeof messageSeenBy.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
export type DomainValidationRun = typeof domainValidationRuns.$inferSelect;
export type NewDomainValidationRun = typeof domainValidationRuns.$inferInsert;
export type DomainValidationCheck = typeof domainValidationChecks.$inferSelect;
export type DomainValidationLogEvent =
	typeof domainValidationLogEvents.$inferSelect;

export const accountRoleEnum = pgEnum("account_role", [
	"user",
	"manager",
	"admin",
	"superadmin",
]);
export const accountStatusEnum = pgEnum("account_status", [
	"pending",
	"active",
	"suspended",
]);

export const accounts = pgTable(
	"accounts",
	{
		id: uuid("id").primaryKey(),
		isIntendant: boolean("is_intendant").notNull().default(false),
		role: accountRoleEnum("role"),
		status: accountStatusEnum("status").notNull().default("pending"),
		loginIdentifier: text("login_identifier").notNull().unique(),
		passwordHash: text("password_hash"),
		primaryMailboxId: uuid("primary_mailbox_id").references(
			() => mailboxes.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		activatedAt: timestamp("activated_at", { withTimezone: true }),
		suspendedAt: timestamp("suspended_at", { withTimezone: true }),
	},
	(table) => [
		index("accounts_primary_mailbox_id_idx").on(table.primaryMailboxId),
		index("accounts_status_idx").on(table.status),
	],
);

export const accountProfiles = pgTable("account_profiles", {
	accountId: uuid("account_id")
		.primaryKey()
		.references(() => accounts.id, { onDelete: "cascade" }),
	firstName: text("first_name").notNull().default(""),
	lastName: text("last_name").notNull().default(""),
	recoveryAddress: text("recovery_address"),
	phone: text("phone"),
	addressCountry: text("address_country"),
	addressState: text("address_state"),
	addressCity: text("address_city"),
	addressLine1: text("address_line1"),
	addressLine2: text("address_line2"),
	profilePictureUpdatedAt: timestamp("profile_picture_updated_at", {
		withTimezone: true,
	}),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const profileFieldLocks = pgTable(
	"profile_field_locks",
	{
		accountId: uuid("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		fieldName: text("field_name").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.accountId, table.fieldName] }),
	],
);

export const accountDomainAssignments = pgTable(
	"account_domain_assignments",
	{
		accountId: uuid("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		domainId: uuid("domain_id")
			.notNull()
			.references(() => domains.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.accountId, table.domainId] }),
		index("account_domain_assignments_domain_id_idx").on(table.domainId),
	],
);

export const managerSharedMailboxAssignments = pgTable(
	"manager_shared_mailbox_assignments",
	{
		accountId: uuid("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		domainId: uuid("domain_id")
			.notNull()
			.references(() => domains.id, { onDelete: "cascade" }),
		mailboxId: uuid("mailbox_id").references(() => mailboxes.id, {
			onDelete: "cascade",
		}),
		allSharedMailboxes: boolean("all_shared_mailboxes")
			.notNull()
			.default(false),
	},
	(table) => [
		index("manager_shared_mailbox_assignments_account_id_idx").on(
			table.accountId,
		),
	],
);

export const mailboxGrants = pgTable(
	"mailbox_grants",
	{
		accountId: uuid("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		mailboxId: uuid("mailbox_id")
			.notNull()
			.references(() => mailboxes.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.accountId, table.mailboxId] }),
		index("mailbox_grants_mailbox_id_idx").on(table.mailboxId),
	],
);

export const domainLocalPartPolicies = pgTable("domain_local_part_policies", {
	domainId: uuid("domain_id")
		.primaryKey()
		.references(() => domains.id, { onDelete: "cascade" }),
		enforced: boolean("enforced").notNull().default(false),
		pattern: text("pattern"),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const invites = pgTable(
	"invites",
	{
		id: uuid("id").primaryKey(),
		accountId: uuid("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		codeHash: text("code_hash").notNull(),
		createdByAccountId: uuid("created_by_account_id")
			.notNull()
			.references(() => accounts.id),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		usedAt: timestamp("used_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("invites_account_id_idx").on(table.accountId)],
);

export const passwordResetCodes = pgTable(
	"password_reset_codes",
	{
		id: uuid("id").primaryKey(),
		accountId: uuid("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		codeHash: text("code_hash").notNull(),
		createdByAccountId: uuid("created_by_account_id")
			.notNull()
			.references(() => accounts.id),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		usedAt: timestamp("used_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("password_reset_codes_account_id_idx").on(table.accountId)],
);

export const emailVerificationPurposeEnum = pgEnum("email_verification_purpose", [
	"recovery_setup",
	"mfa_disable",
]);

export const emailVerificationCodes = pgTable(
	"email_verification_codes",
	{
		id: uuid("id").primaryKey(),
		accountId: uuid("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		targetEmail: text("target_email").notNull(),
		purpose: emailVerificationPurposeEnum("purpose").notNull(),
		codeHash: text("code_hash").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		usedAt: timestamp("used_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("email_verification_codes_account_id_idx").on(table.accountId),
	],
);

export const sessions = pgTable(
	"sessions",
	{
		id: uuid("id").primaryKey(),
		accountId: uuid("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		tokenHash: text("token_hash").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		absoluteExpiresAt: timestamp("absolute_expires_at", {
			withTimezone: true,
		}).notNull(),
		userAgent: text("user_agent"),
		ipAddress: text("ip_address"),
		countryCode: text("country_code"),
	},
	(table) => [
		index("sessions_account_id_idx").on(table.accountId),
		index("sessions_expires_at_idx").on(table.expiresAt),
	],
);

export const apiKeys = pgTable(
	"api_keys",
	{
		id: uuid("id").primaryKey(),
		accountId: uuid("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		prefix: text("prefix").notNull(),
		keyHash: text("key_hash").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
	},
	(table) => [index("api_keys_account_id_idx").on(table.accountId)],
);

export const oidcClients = pgTable("oidc_clients", {
	id: uuid("id").primaryKey(),
	clientId: text("client_id").notNull().unique(),
	clientSecretHash: text("client_secret_hash"),
	name: text("name").notNull(),
	redirectUris: text("redirect_uris").array().notNull(),
	allowedScopes: text("allowed_scopes").array().notNull(),
	m2mPermissions: text("m2m_permissions").array().notNull().default([]),
	isConfidential: boolean("is_confidential").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const oidcAuthorizationCodes = pgTable(
	"oidc_authorization_codes",
	{
		id: uuid("id").primaryKey(),
		codeHash: text("code_hash").notNull().unique(),
		clientId: text("client_id").notNull(),
		accountId: uuid("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		redirectUri: text("redirect_uri").notNull(),
		scopes: text("scopes").array().notNull(),
		codeChallenge: text("code_challenge"),
		codeChallengeMethod: text("code_challenge_method"),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		usedAt: timestamp("used_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("oidc_authorization_codes_client_id_idx").on(table.clientId)],
);

export const oidcRefreshTokens = pgTable(
	"oidc_refresh_tokens",
	{
		id: uuid("id").primaryKey(),
		tokenHash: text("token_hash").notNull().unique(),
		clientId: text("client_id").notNull(),
		accountId: uuid("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		scopes: text("scopes").array().notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("oidc_refresh_tokens_account_id_idx").on(table.accountId)],
);

export const organizationTabAccessEnum = pgEnum("organization_tab_access", [
	"intendant_only",
	"intendant_and_superadmins",
]);

export const requireMfaScopeEnum = pgEnum("require_mfa_scope", [
	"none",
	"all",
	"manager_and_above",
	"admin_and_above",
	"superadmin_and_above",
]);

export const instanceSettings = pgTable("instance_settings", {
	id: text("id").primaryKey().default("default"),
	organizationTabAccess: organizationTabAccessEnum("organization_tab_access")
		.notNull()
		.default("intendant_only"),
	requireMfaScope: requireMfaScopeEnum("require_mfa_scope")
		.notNull()
		.default("none"),
	requireRecoveryEmail: boolean("require_recovery_email")
		.notNull()
		.default(false),
	persistNoreplyOutboundEmails: boolean("persist_noreply_outbound_emails")
		.notNull()
		.default(false),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedByAccountId: uuid("updated_by_account_id").references(
		() => accounts.id,
		{ onDelete: "set null" },
	),
});

export const accountTotp = pgTable("account_totp", {
	accountId: uuid("account_id")
		.primaryKey()
		.references(() => accounts.id, { onDelete: "cascade" }),
	secretEncrypted: text("secret_encrypted").notNull(),
	enabledAt: timestamp("enabled_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const accountPasskeys = pgTable(
	"account_passkeys",
	{
		id: uuid("id").primaryKey(),
		accountId: uuid("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		credentialId: text("credential_id").notNull(),
		publicKey: text("public_key").notNull(),
		signCount: integer("sign_count").notNull().default(0),
		name: text("name"),
		transports: text("transports"),
		backedUp: boolean("backed_up").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("account_passkeys_credential_id_idx").on(table.credentialId),
		index("account_passkeys_account_id_idx").on(table.accountId),
	],
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type AccountProfile = typeof accountProfiles.$inferSelect;
export type InstanceSettings = typeof instanceSettings.$inferSelect;
export type AccountTotp = typeof accountTotp.$inferSelect;
export type AccountPasskey = typeof accountPasskeys.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type OidcClient = typeof oidcClients.$inferSelect;
