CREATE TYPE "public"."domain_readiness_badge" AS ENUM('checking', 'fail', 'healthy', 'unhealthy');
CREATE TYPE "public"."domain_validation_run_status" AS ENUM('checking', 'completed');
CREATE TYPE "public"."validation_check_key" AS ENUM('mx', 'dmarc_rua', 'loop_send', 'loop_receive');
CREATE TYPE "public"."validation_check_status" AS ENUM('pending', 'passed', 'failed', 'skipped');
CREATE TYPE "public"."validation_check_tier" AS ENUM('critical', 'advisory');
CREATE TYPE "public"."validation_log_level" AS ENUM('info', 'warning', 'error');
CREATE TYPE "public"."validation_log_stage" AS ENUM('dns', 'send', 'receive', 'summary');

CREATE TABLE "domain_validation_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"domain_id" uuid NOT NULL,
	"status" "domain_validation_run_status" DEFAULT 'checking' NOT NULL,
	"badge" "domain_readiness_badge" DEFAULT 'checking' NOT NULL,
	"token" text NOT NULL,
	"receive_deadline_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domain_validation_runs_token_unique" UNIQUE("token")
);

CREATE TABLE "domain_validation_checks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"check_key" "validation_check_key" NOT NULL,
	"tier" "validation_check_tier" NOT NULL,
	"status" "validation_check_status" DEFAULT 'pending' NOT NULL,
	"code" text,
	"message" text,
	"checked_at" timestamp with time zone,
	CONSTRAINT "domain_validation_checks_run_id_check_key_unique" UNIQUE("run_id", "check_key")
);

CREATE TABLE "domain_validation_log_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"level" "validation_log_level" NOT NULL,
	"stage" "validation_log_stage" NOT NULL,
	"code" text,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "domain_validation_runs" ADD CONSTRAINT "domain_validation_runs_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "domain_validation_checks" ADD CONSTRAINT "domain_validation_checks_run_id_domain_validation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."domain_validation_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "domain_validation_log_events" ADD CONSTRAINT "domain_validation_log_events_run_id_domain_validation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."domain_validation_runs"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "domain_validation_runs_domain_id_started_at_idx" ON "domain_validation_runs" USING btree ("domain_id", "started_at" DESC);
CREATE INDEX "domain_validation_runs_status_receive_deadline_at_idx" ON "domain_validation_runs" USING btree ("status", "receive_deadline_at");
CREATE UNIQUE INDEX "domain_validation_runs_one_active_per_domain_idx" ON "domain_validation_runs" ("domain_id") WHERE "status" = 'checking';
CREATE INDEX "domain_validation_checks_run_id_idx" ON "domain_validation_checks" USING btree ("run_id");
CREATE INDEX "domain_validation_log_events_run_id_created_at_idx" ON "domain_validation_log_events" USING btree ("run_id", "created_at");
