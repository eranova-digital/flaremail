ALTER TABLE "messages" ADD COLUMN "thread_id" uuid;--> statement-breakpoint
UPDATE "messages" SET "thread_id" = gen_random_uuid() WHERE "thread_id" IS NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "thread_id" SET NOT NULL;
