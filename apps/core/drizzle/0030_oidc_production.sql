ALTER TABLE "oidc_clients" ADD COLUMN "require_consent" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "oidc_clients" ADD COLUMN "created_by_account_id" uuid;--> statement-breakpoint
ALTER TABLE "oidc_clients" ADD CONSTRAINT "oidc_clients_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_refresh_tokens" ADD COLUMN "family_id" uuid NOT NULL DEFAULT gen_random_uuid();--> statement-breakpoint
CREATE INDEX "oidc_refresh_tokens_family_id_idx" ON "oidc_refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE TABLE "oidc_consent_grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"scopes" text[] NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oidc_consent_grants_account_client_uid" UNIQUE("account_id","client_id")
);--> statement-breakpoint
ALTER TABLE "oidc_consent_grants" ADD CONSTRAINT "oidc_consent_grants_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oidc_consent_grants_client_id_idx" ON "oidc_consent_grants" USING btree ("client_id");--> statement-breakpoint
CREATE TABLE "oidc_pending_authorizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"scopes" text[] NOT NULL,
	"state" text,
	"nonce" text,
	"code_challenge" text NOT NULL,
	"code_challenge_method" text NOT NULL,
	"account_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "oidc_pending_authorizations" ADD CONSTRAINT "oidc_pending_authorizations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oidc_pending_authorizations_expires_at_idx" ON "oidc_pending_authorizations" USING btree ("expires_at");
