ALTER TABLE "thread_mailboxes" ADD COLUMN "preview" varchar(200);--> statement-breakpoint
ALTER TABLE "thread_mailboxes" ADD COLUMN "last_message_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "thread_mailboxes" ADD COLUMN "message_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "thread_mailboxes" ADD COLUMN "is_read" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "thread_mailboxes" ADD COLUMN "is_starred" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "thread_mailboxes" ADD COLUMN "folder" "thread_folder" DEFAULT 'inbox' NOT NULL;--> statement-breakpoint
ALTER TABLE "thread_mailboxes" ADD COLUMN "restore_folder" "thread_folder";--> statement-breakpoint
ALTER TABLE "thread_mailboxes" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "thread_mailboxes" ADD COLUMN "trashed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "thread_mailboxes" ADD COLUMN "marked_as_spam_at" timestamp with time zone;--> statement-breakpoint
UPDATE "thread_mailboxes" tm
SET
	"preview" = t."preview",
	"last_message_at" = t."last_message_at",
	"message_count" = t."message_count",
	"is_read" = t."is_read",
	"is_starred" = t."is_starred",
	"folder" = t."folder",
	"restore_folder" = t."restore_folder",
	"archived_at" = t."archived_at",
	"trashed_at" = t."trashed_at",
	"marked_as_spam_at" = t."marked_as_spam_at"
FROM "threads" t
WHERE tm."thread_id" = t."id";--> statement-breakpoint
CREATE TABLE "message_mailboxes" (
	"message_id" uuid NOT NULL,
	"mailbox_id" uuid NOT NULL,
	CONSTRAINT "message_mailboxes_message_id_mailbox_id_pk" PRIMARY KEY("message_id","mailbox_id")
);--> statement-breakpoint
ALTER TABLE "message_mailboxes" ADD CONSTRAINT "message_mailboxes_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_mailboxes" ADD CONSTRAINT "message_mailboxes_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_mailboxes_mailbox_id_idx" ON "message_mailboxes" USING btree ("mailbox_id");--> statement-breakpoint
INSERT INTO "message_mailboxes" ("message_id", "mailbox_id")
SELECT "id", "actual_mailbox_id" FROM "messages"
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "message_mailboxes" ("message_id", "mailbox_id")
SELECT "id", "matched_mailbox_id" FROM "messages" WHERE "matched_mailbox_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
DROP INDEX IF EXISTS "threads_folder_last_message_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "threads_last_message_at_idx";--> statement-breakpoint
CREATE INDEX "thread_mailboxes_mailbox_id_folder_last_message_at_idx" ON "thread_mailboxes" USING btree ("mailbox_id","folder","last_message_at");--> statement-breakpoint
CREATE INDEX "thread_mailboxes_mailbox_id_last_message_at_idx" ON "thread_mailboxes" USING btree ("mailbox_id","last_message_at");--> statement-breakpoint
ALTER TABLE "threads" DROP COLUMN "preview";--> statement-breakpoint
ALTER TABLE "threads" DROP COLUMN "last_message_at";--> statement-breakpoint
ALTER TABLE "threads" DROP COLUMN "message_count";--> statement-breakpoint
ALTER TABLE "threads" DROP COLUMN "is_read";--> statement-breakpoint
ALTER TABLE "threads" DROP COLUMN "is_starred";--> statement-breakpoint
ALTER TABLE "threads" DROP COLUMN "folder";--> statement-breakpoint
ALTER TABLE "threads" DROP COLUMN "restore_folder";--> statement-breakpoint
ALTER TABLE "threads" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "threads" DROP COLUMN "trashed_at";--> statement-breakpoint
ALTER TABLE "threads" DROP COLUMN "marked_as_spam_at";
