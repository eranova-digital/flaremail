CREATE TYPE "public"."account_role" AS ENUM('user', 'manager', 'admin', 'superadmin');--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('pending', 'active', 'suspended');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"is_intendant" boolean DEFAULT false NOT NULL,
	"role" "account_role",
	"status" "account_status" DEFAULT 'pending' NOT NULL,
	"login_identifier" text NOT NULL,
	"password_hash" text,
	"primary_mailbox_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	CONSTRAINT "accounts_login_identifier_unique" UNIQUE("login_identifier")
);--> statement-breakpoint
CREATE TABLE "account_profiles" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"recovery_address" text,
	"phone" text,
	"address_country" text,
	"address_state" text,
	"address_city" text,
	"address_line1" text,
	"address_line2" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "profile_field_locks" (
	"account_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	CONSTRAINT "profile_field_locks_account_id_field_name_pk" PRIMARY KEY("account_id","field_name")
);--> statement-breakpoint
CREATE TABLE "account_domain_assignments" (
	"account_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	CONSTRAINT "account_domain_assignments_account_id_domain_id_pk" PRIMARY KEY("account_id","domain_id")
);--> statement-breakpoint
CREATE TABLE "manager_shared_mailbox_assignments" (
	"account_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"mailbox_id" uuid,
	"all_shared_mailboxes" boolean DEFAULT false NOT NULL
);--> statement-breakpoint
CREATE TABLE "mailbox_grants" (
	"account_id" uuid NOT NULL,
	"mailbox_id" uuid NOT NULL,
	CONSTRAINT "mailbox_grants_account_id_mailbox_id_pk" PRIMARY KEY("account_id","mailbox_id")
);--> statement-breakpoint
CREATE TABLE "domain_local_part_policies" (
	"domain_id" uuid PRIMARY KEY NOT NULL,
	"enforced" boolean DEFAULT false NOT NULL,
	"pattern" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "password_reset_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "oidc_clients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_hash" text,
	"name" text NOT NULL,
	"redirect_uris" text[] NOT NULL,
	"allowed_scopes" text[] NOT NULL,
	"m2m_permissions" text[] DEFAULT '{}' NOT NULL,
	"is_confidential" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oidc_clients_client_id_unique" UNIQUE("client_id")
);--> statement-breakpoint
CREATE TABLE "oidc_authorization_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"client_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"redirect_uri" text NOT NULL,
	"scopes" text[] NOT NULL,
	"code_challenge" text,
	"code_challenge_method" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oidc_authorization_codes_code_hash_unique" UNIQUE("code_hash")
);--> statement-breakpoint
CREATE TABLE "oidc_refresh_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"client_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"scopes" text[] NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oidc_refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_primary_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("primary_mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_profiles" ADD CONSTRAINT "account_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_field_locks" ADD CONSTRAINT "profile_field_locks_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_domain_assignments" ADD CONSTRAINT "account_domain_assignments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_domain_assignments" ADD CONSTRAINT "account_domain_assignments_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_shared_mailbox_assignments" ADD CONSTRAINT "manager_shared_mailbox_assignments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_shared_mailbox_assignments" ADD CONSTRAINT "manager_shared_mailbox_assignments_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_shared_mailbox_assignments" ADD CONSTRAINT "manager_shared_mailbox_assignments_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mailbox_grants" ADD CONSTRAINT "mailbox_grants_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mailbox_grants" ADD CONSTRAINT "mailbox_grants_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_local_part_policies" ADD CONSTRAINT "domain_local_part_policies_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_authorization_codes" ADD CONSTRAINT "oidc_authorization_codes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_refresh_tokens" ADD CONSTRAINT "oidc_refresh_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_primary_mailbox_id_idx" ON "accounts" USING btree ("primary_mailbox_id");--> statement-breakpoint
CREATE INDEX "accounts_status_idx" ON "accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "account_domain_assignments_domain_id_idx" ON "account_domain_assignments" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "manager_shared_mailbox_assignments_account_id_idx" ON "manager_shared_mailbox_assignments" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "mailbox_grants_mailbox_id_idx" ON "mailbox_grants" USING btree ("mailbox_id");--> statement-breakpoint
CREATE INDEX "invites_account_id_idx" ON "invites" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "password_reset_codes_account_id_idx" ON "password_reset_codes" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "sessions_account_id_idx" ON "sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "api_keys_account_id_idx" ON "api_keys" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "oidc_authorization_codes_client_id_idx" ON "oidc_authorization_codes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oidc_refresh_tokens_account_id_idx" ON "oidc_refresh_tokens" USING btree ("account_id");
