CREATE TYPE "public"."competitor_observation_data_quality" AS ENUM('metadata_only');--> statement-breakpoint
CREATE TYPE "public"."competitor_retrieval_method" AS ENUM('rss_atom');--> statement-breakpoint
CREATE TYPE "public"."competitor_source_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TABLE "competitor_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"source_url" text NOT NULL,
	"content_published_at" timestamp with time zone,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retrieval_method" "competitor_retrieval_method" NOT NULL,
	"data_quality" "competitor_observation_data_quality" DEFAULT 'metadata_only' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"feed_url" text NOT NULL,
	"retrieval_method" "competitor_retrieval_method" DEFAULT 'rss_atom' NOT NULL,
	"status" "competitor_source_status" DEFAULT 'active' NOT NULL,
	"next_fetch_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"last_fetched_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_error_code" text,
	"etag" text,
	"last_modified" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitor_sources_org_id_brand_unique" UNIQUE("organization_id","id","brand_id")
);
--> statement-breakpoint
ALTER TABLE "competitor_observations" ADD CONSTRAINT "competitor_observations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_observations" ADD CONSTRAINT "competitor_observations_org_brand_fk" FOREIGN KEY ("organization_id","brand_id") REFERENCES "public"."brands"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_observations" ADD CONSTRAINT "competitor_observations_org_source_fk" FOREIGN KEY ("organization_id","source_id","brand_id") REFERENCES "public"."competitor_sources"("organization_id","id","brand_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_sources" ADD CONSTRAINT "competitor_sources_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_sources" ADD CONSTRAINT "competitor_sources_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_sources" ADD CONSTRAINT "competitor_sources_org_brand_fk" FOREIGN KEY ("organization_id","brand_id") REFERENCES "public"."brands"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "competitor_observations_source_external_unique" ON "competitor_observations" USING btree ("organization_id","source_id","external_id");--> statement-breakpoint
CREATE INDEX "competitor_observations_org_brand_date_idx" ON "competitor_observations" USING btree ("organization_id","brand_id","content_published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "competitor_sources_org_brand_url_unique" ON "competitor_sources" USING btree ("organization_id","brand_id","feed_url");--> statement-breakpoint
CREATE INDEX "competitor_sources_due_idx" ON "competitor_sources" USING btree ("status","next_fetch_at","locked_at");