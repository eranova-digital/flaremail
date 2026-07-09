ALTER TYPE "public"."mailbox_type" ADD VALUE IF NOT EXISTS 'blackhole';

UPDATE "mailboxes"
SET
	"type" = 'blackhole',
	"alias_target_id" = NULL,
	"alias_target_address" = NULL,
	"updated_at" = NOW()
WHERE "local_part" = 'noreply' AND "type" = 'alias';
