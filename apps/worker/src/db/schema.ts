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
			.references(() => mailboxes.id),
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
			.references(() => messages.id),
		filename: text("filename"),
		mimeType: text("mime_type").notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		disposition: text("disposition"),
		contentId: text("content_id"),
		storageKey: text("storage_key").notNull().unique(),
	},
	(table) => [index("attachments_message_id_idx").on(table.messageId)],
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
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
