ALTER TABLE "messages" ADD COLUMN "from" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "to" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "bcc" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "preview" varchar(200);--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "has_html" boolean;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "raw_eml_key" text;--> statement-breakpoint
UPDATE "messages" SET
	"from" = "from_address",
	"to" = "to_address",
	"preview" = LEFT("text_body", 200),
	"has_html" = COALESCE("html_body" IS NOT NULL AND "html_body" <> '', false),
	"sent_at" = "received_at",
	"received_at" = COALESCE("created_at", NOW()),
	"raw_eml_key" = 'raw/' || "id"::text || '.eml';--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "from" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "to" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "has_html" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "received_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "raw_eml_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "from_address";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "to_address";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "html_body";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "reply_to";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "raw_size";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "created_at";
