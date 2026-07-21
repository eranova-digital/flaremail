CREATE TYPE "system_email_template_key" AS ENUM('invite', 'password_reset', 'recovery_verify', 'mfa_disable');--> statement-breakpoint
CREATE TABLE "system_email_templates" (
	"key" "system_email_template_key" PRIMARY KEY NOT NULL,
	"storage_key" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_account_id" uuid
);--> statement-breakpoint
ALTER TABLE "system_email_templates" ADD CONSTRAINT "system_email_templates_updated_by_account_id_accounts_id_fk" FOREIGN KEY ("updated_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
