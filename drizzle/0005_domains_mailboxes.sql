CREATE TYPE "public"."mailbox_type" AS ENUM('primary', 'alias');--> statement-breakpoint
CREATE TYPE "public"."matched_via" AS ENUM('exact', 'alias', 'catch_all');--> statement-breakpoint
DELETE FROM "attachments";--> statement-breakpoint
DELETE FROM "messages";--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"catch_all_enabled" boolean DEFAULT false NOT NULL,
	"catch_all_mailbox_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domains_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "mailboxes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"domain_id" uuid NOT NULL,
	"local_part" text NOT NULL,
	"address" text NOT NULL,
	"type" "mailbox_type" NOT NULL,
	"alias_target_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mailboxes_address_unique" UNIQUE("address"),
	CONSTRAINT "mailboxes_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "mailboxes_alias_target_id_mailboxes_id_fk" FOREIGN KEY ("alias_target_id") REFERENCES "public"."mailboxes"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_catch_all_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("catch_all_mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mailboxes_domain_id_local_part_idx" ON "mailboxes" USING btree ("domain_id","local_part");--> statement-breakpoint
CREATE INDEX "mailboxes_address_idx" ON "mailboxes" USING btree ("address");--> statement-breakpoint
CREATE INDEX "mailboxes_alias_target_id_idx" ON "mailboxes" USING btree ("alias_target_id");--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "envelope_to" text NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "primary_mailbox_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "matched_mailbox_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "matched_via" "matched_via" NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_primary_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("primary_mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_matched_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("matched_mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_primary_mailbox_id_received_at_idx" ON "messages" USING btree ("primary_mailbox_id","received_at");
