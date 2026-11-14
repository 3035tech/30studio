CREATE TYPE "public"."content_media_review_decision" AS ENUM('approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."content_media_status" AS ENUM('queued', 'processing', 'pending_review', 'approved', 'rejected', 'failed');--> statement-breakpoint
CREATE TABLE "content_media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"content_item_id" uuid NOT NULL,
	"content_version_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text,
	"size_bytes" integer,
	"width" integer,
	"height" integer,
	"sha256" text,
	"prompt" text NOT NULL,
	"model_id" text NOT NULL,
	"status" "content_media_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"failure_code" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "content_media_assets_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "content_media_org_id_brand_unique" UNIQUE("organization_id","id","brand_id")
);
--> statement-breakpoint
CREATE TABLE "content_media_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"reviewer_id" text NOT NULL,
	"decision" "content_media_review_decision" NOT NULL,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_media_assets" ADD CONSTRAINT "content_media_assets_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_media_assets" ADD CONSTRAINT "content_media_assets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_media_assets" ADD CONSTRAINT "content_media_assets_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_media_assets" ADD CONSTRAINT "content_media_org_item_brand_fk" FOREIGN KEY ("organization_id","content_item_id","brand_id") REFERENCES "public"."content_items"("organization_id","id","brand_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_media_assets" ADD CONSTRAINT "content_media_org_version_item_brand_fk" FOREIGN KEY ("organization_id","content_version_id","content_item_id","brand_id") REFERENCES "public"."content_versions"("organization_id","id","content_item_id","brand_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_media_reviews" ADD CONSTRAINT "content_media_reviews_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_media_reviews" ADD CONSTRAINT "content_media_reviews_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_media_reviews" ADD CONSTRAINT "content_media_reviews_org_asset_fk" FOREIGN KEY ("organization_id","media_asset_id","brand_id") REFERENCES "public"."content_media_assets"("organization_id","id","brand_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_media_idempotency_unique" ON "content_media_assets" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "content_media_version_created_idx" ON "content_media_assets" USING btree ("organization_id","content_version_id","created_at");--> statement-breakpoint
CREATE INDEX "content_media_queue_idx" ON "content_media_assets" USING btree ("status","available_at","created_at");--> statement-breakpoint
CREATE INDEX "content_media_reviews_org_asset_time_idx" ON "content_media_reviews" USING btree ("organization_id","media_asset_id","occurred_at");--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_org_item_brand_fk" FOREIGN KEY ("organization_id","content_item_id","brand_id") REFERENCES "public"."content_items"("organization_id","id","brand_id") ON DELETE cascade ON UPDATE no action;