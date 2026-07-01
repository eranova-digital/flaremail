CREATE TYPE "public"."thread_folder" AS ENUM('inbox', 'spam', 'trash', 'archived', 'drafts', 'sent');--> statement-breakpoint
ALTER TYPE "public"."mailbox_type" ADD VALUE IF NOT EXISTS 'secondary';--> statement-breakpoint
ALTER TYPE "public"."mailbox_type" ADD VALUE IF NOT EXISTS 'shared';--> statement-breakpoint
CREATE TABLE "threads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subject" text,
	"preview" varchar(200),
	"last_message_at" timestamp with time zone NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"folder" "thread_folder" DEFAULT 'inbox' NOT NULL,
	"archived_at" timestamp with time zone,
	"trashed_at" timestamp with time zone,
	"marked_as_spam_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thread_mailboxes" (
	"thread_id" uuid NOT NULL,
	"mailbox_id" uuid NOT NULL,
	CONSTRAINT "thread_mailboxes_thread_id_mailbox_id_pk" PRIMARY KEY("thread_id","mailbox_id")
);
--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mailbox_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thread_labels" (
	"thread_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	CONSTRAINT "thread_labels_thread_id_label_id_pk" PRIMARY KEY("thread_id","label_id")
);
--> statement-breakpoint
INSERT INTO "threads" (
	"id",
	"subject",
	"preview",
	"last_message_at",
	"message_count",
	"is_read",
	"is_starred",
	"folder",
	"created_at",
	"updated_at"
)
SELECT
	"thread_id",
	MAX("subject"),
	MAX("preview"),
	MAX("received_at"),
	COUNT(*)::integer,
	false,
	false,
	'inbox',
	MIN("received_at"),
	MAX("received_at")
FROM "messages"
GROUP BY "thread_id";
--> statement-breakpoint
INSERT INTO "thread_mailboxes" ("thread_id", "mailbox_id")
SELECT DISTINCT "thread_id", "primary_mailbox_id"
FROM "messages"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "thread_mailboxes" ("thread_id", "mailbox_id")
SELECT DISTINCT "thread_id", "matched_mailbox_id"
FROM "messages"
WHERE "matched_mailbox_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_mailboxes" ADD CONSTRAINT "thread_mailboxes_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_mailboxes" ADD CONSTRAINT "thread_mailboxes_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_labels" ADD CONSTRAINT "thread_labels_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_labels" ADD CONSTRAINT "thread_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "threads_folder_last_message_at_idx" ON "threads" USING btree ("folder","last_message_at");--> statement-breakpoint
CREATE INDEX "threads_last_message_at_idx" ON "threads" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "thread_mailboxes_mailbox_id_idx" ON "thread_mailboxes" USING btree ("mailbox_id");--> statement-breakpoint
CREATE UNIQUE INDEX "labels_mailbox_id_name_idx" ON "labels" USING btree ("mailbox_id","name");--> statement-breakpoint
CREATE INDEX "thread_labels_label_id_idx" ON "thread_labels" USING btree ("label_id");--> statement-breakpoint
ALTER TABLE "messages" RENAME COLUMN "primary_mailbox_id" TO "actual_mailbox_id";--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_primary_mailbox_id_mailboxes_id_fk";--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_actual_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("actual_mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP INDEX "messages_primary_mailbox_id_received_at_idx";--> statement-breakpoint
CREATE INDEX "messages_actual_mailbox_id_received_at_idx" ON "messages" USING btree ("actual_mailbox_id","received_at");
