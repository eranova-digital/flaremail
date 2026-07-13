CREATE TABLE "account_passkeys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"sign_count" integer DEFAULT 0 NOT NULL,
	"name" text,
	"transports" text,
	"backed_up" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "account_passkeys" ADD CONSTRAINT "account_passkeys_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "account_passkeys_credential_id_idx" ON "account_passkeys" USING btree ("credential_id");
--> statement-breakpoint
CREATE INDEX "account_passkeys_account_id_idx" ON "account_passkeys" USING btree ("account_id");
