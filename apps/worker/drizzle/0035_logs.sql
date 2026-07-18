CREATE TYPE "log_type" AS ENUM('auth', 'accounts', 'invites', 'mailboxes', 'mailing', 'threads', 'messages', 'identities', 'domains', 'settings', 'oidc', 'api-keys');--> statement-breakpoint
CREATE TYPE "log_retention_days" AS ENUM('3', '7', '14', '30', '60', '90');--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "logs_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "max_importance_stored" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "log_retention_days" "log_retention_days" DEFAULT '14' NOT NULL;--> statement-breakpoint
CREATE TABLE "logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"importance" integer NOT NULL,
	"type" "log_type" NOT NULL,
	"summary" text NOT NULL,
	"refs" text DEFAULT '{}' NOT NULL,
	"actor_account_id" uuid,
	"context" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "logs_created_at_idx" ON "logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "logs_importance_idx" ON "logs" USING btree ("importance");--> statement-breakpoint
CREATE INDEX "logs_type_idx" ON "logs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "logs_importance_created_at_idx" ON "logs" USING btree ("importance","created_at");
