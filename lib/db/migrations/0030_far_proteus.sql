CREATE TYPE "public"."competitor_fetch_run_status" AS ENUM('running', 'succeeded', 'failed', 'interrupted');--> statement-breakpoint
CREATE TABLE "competitor_alert_settings" (
	"organization_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"failure_threshold" integer DEFAULT 3 NOT NULL,
	"stale_after_hours" integer DEFAULT 36 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitor_alert_settings_org_brand_unique" UNIQUE("organization_id","brand_id")
);
--> statement-breakpoint
CREATE TABLE "competitor_fetch_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "competitor_fetch_run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"new_item_count" integer DEFAULT 0 NOT NULL,
	"error_code" text
);
--> statement-breakpoint
CREATE TABLE "competitor_worker_heartbeat" (
	"worker_key" text PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competitor_alert_settings" ADD CONSTRAINT "competitor_alert_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_alert_settings" ADD CONSTRAINT "competitor_alert_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_alert_settings" ADD CONSTRAINT "competitor_alert_settings_org_brand_fk" FOREIGN KEY ("organization_id","brand_id") REFERENCES "public"."brands"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_fetch_runs" ADD CONSTRAINT "competitor_fetch_runs_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_fetch_runs" ADD CONSTRAINT "competitor_fetch_runs_org_source_fk" FOREIGN KEY ("organization_id","source_id","brand_id") REFERENCES "public"."competitor_sources"("organization_id","id","brand_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competitor_fetch_runs_org_brand_source_time_idx" ON "competitor_fetch_runs" USING btree ("organization_id","brand_id","source_id","started_at");--> statement-breakpoint
CREATE INDEX "competitor_observations_org_brand_analysis_idx" ON "competitor_observations" USING btree ("organization_id","brand_id","analysis_status");