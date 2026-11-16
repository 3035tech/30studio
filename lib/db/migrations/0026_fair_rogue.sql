CREATE TYPE "public"."social_analytics_collection_status" AS ENUM('success', 'permission_denied', 'authentication_required', 'unavailable');--> statement-breakpoint
CREATE TABLE "social_analytics_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"social_profile_id" uuid NOT NULL,
	"publication_job_id" uuid NOT NULL,
	"collection_status" "social_analytics_collection_status" NOT NULL,
	"likes" integer,
	"comments" integer,
	"shares" integer,
	"source" text NOT NULL,
	"definition_version" text NOT NULL,
	"coverage" text DEFAULT 'post_lifetime' NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_analytics_snapshots" ADD CONSTRAINT "social_analytics_snapshots_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_analytics_snapshots" ADD CONSTRAINT "social_analytics_snapshots_org_brand_fk" FOREIGN KEY ("organization_id","brand_id") REFERENCES "public"."brands"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_analytics_snapshots" ADD CONSTRAINT "social_analytics_snapshots_org_profile_fk" FOREIGN KEY ("organization_id","brand_id","social_profile_id") REFERENCES "public"."social_profiles"("organization_id","brand_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_analytics_snapshots" ADD CONSTRAINT "social_analytics_snapshots_job_fk" FOREIGN KEY ("publication_job_id") REFERENCES "public"."social_publication_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "social_analytics_snapshots_org_time_idx" ON "social_analytics_snapshots" USING btree ("organization_id","collected_at");--> statement-breakpoint
CREATE INDEX "social_analytics_snapshots_org_brand_time_idx" ON "social_analytics_snapshots" USING btree ("organization_id","brand_id","collected_at");--> statement-breakpoint
CREATE INDEX "social_analytics_snapshots_org_job_time_idx" ON "social_analytics_snapshots" USING btree ("organization_id","publication_job_id","collected_at");