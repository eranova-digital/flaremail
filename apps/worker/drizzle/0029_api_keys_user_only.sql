UPDATE "api_keys"
SET "account_id" = "created_by_account_id"
WHERE "account_id" IS NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" DROP CONSTRAINT IF EXISTS "api_keys_created_by_account_id_accounts_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "api_keys_created_by_account_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "api_keys_kind_idx";--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "created_by_account_id";--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "kind";--> statement-breakpoint
DROP TYPE IF EXISTS "api_key_kind";
