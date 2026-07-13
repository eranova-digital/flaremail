CREATE TABLE IF NOT EXISTS "thread_seen_by" (
	"thread_id" uuid NOT NULL REFERENCES "threads"("id") ON DELETE CASCADE,
	"mailbox_id" uuid NOT NULL REFERENCES "mailboxes"("id") ON DELETE CASCADE,
	"account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
	"seen_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "thread_seen_by_pkey" PRIMARY KEY ("thread_id","mailbox_id","account_id")
);

CREATE INDEX IF NOT EXISTS "thread_seen_by_mailbox_id_thread_id_idx" ON "thread_seen_by" ("mailbox_id","thread_id");
CREATE INDEX IF NOT EXISTS "thread_seen_by_thread_id_idx" ON "thread_seen_by" ("thread_id");

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sent_by_account_id" uuid REFERENCES "accounts"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "messages_sent_by_account_id_idx" ON "messages" ("sent_by_account_id");
