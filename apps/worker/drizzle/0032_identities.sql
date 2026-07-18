CREATE TYPE "identity_name_pattern" AS ENUM('none', 'first_name', 'last_name', 'first_name_last_name', 'last_name_first_name', 'first_initial_last_name', 'last_name_first_initial', 'first_name_last_initial', 'last_initial_first_name', 'custom');--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN "personal_identity_allowance" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN "identity_export" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "identity_self_serve" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "custom_name_allowance" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "default_identity_name_pattern" "identity_name_pattern" DEFAULT 'first_name_last_name' NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "default_identity_custom_name" text;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "default_identity_signature_html" text;--> statement-breakpoint
CREATE TABLE "identities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mailbox_id" uuid NOT NULL,
	"name_pattern" "identity_name_pattern" NOT NULL,
	"custom_name" text,
	"signature_html" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identities_mailbox_id_idx" ON "identities" USING btree ("mailbox_id");
