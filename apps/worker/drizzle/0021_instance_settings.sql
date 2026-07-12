CREATE TYPE "organization_tab_access" AS ENUM('intendant_only', 'intendant_and_superadmins');--> statement-breakpoint
CREATE TYPE "require_mfa_scope" AS ENUM('none', 'all', 'manager_and_above', 'admin_and_above', 'superadmin_and_above');--> statement-breakpoint
CREATE TABLE "instance_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"organization_tab_access" "organization_tab_access" DEFAULT 'intendant_only' NOT NULL,
	"require_mfa_scope" "require_mfa_scope" DEFAULT 'none' NOT NULL,
	"require_recovery_email" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_account_id" uuid
);--> statement-breakpoint
ALTER TABLE "instance_settings" ADD CONSTRAINT "instance_settings_updated_by_account_id_accounts_id_fk" FOREIGN KEY ("updated_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "instance_settings" ("id") VALUES ('default');
