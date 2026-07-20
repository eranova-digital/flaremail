DROP TABLE IF EXISTS "thread_seen_by";

CREATE TABLE IF NOT EXISTS "message_seen_by" (
	"message_id" uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
	"mailbox_id" uuid NOT NULL REFERENCES "mailboxes"("id") ON DELETE CASCADE,
	"account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
	"seen_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "message_seen_by_pkey" PRIMARY KEY ("message_id","mailbox_id","account_id")
);

CREATE INDEX IF NOT EXISTS "message_seen_by_mailbox_id_message_id_idx" ON "message_seen_by" ("mailbox_id","message_id");
CREATE INDEX IF NOT EXISTS "message_seen_by_message_id_idx" ON "message_seen_by" ("message_id");
