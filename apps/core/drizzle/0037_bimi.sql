CREATE TYPE "public"."dmarc_result" AS ENUM('pass', 'fail', 'none', 'temperror', 'permerror');--> statement-breakpoint
CREATE TYPE "public"."bimi_logo_status" AS ENUM('found', 'missing');--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "dmarc_result" "dmarc_result";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "bimi_domain" text;--> statement-breakpoint
CREATE TABLE "bimi_logos" (
	"domain" text PRIMARY KEY NOT NULL,
	"status" "bimi_logo_status" NOT NULL,
	"source_url" text,
	"storage_key" text,
	"checked_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"logo_updated_at" timestamp with time zone
);
