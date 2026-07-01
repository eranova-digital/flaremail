ALTER TYPE "public"."matched_via" ADD VALUE IF NOT EXISTS 'outbound';--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."send_status" AS ENUM('draft', 'sending', 'sent', 'failed');--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "direction" "message_direction" DEFAULT 'inbound' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "send_status" "send_status";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "cf_email_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "send_error_code" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "send_error_message" text;
