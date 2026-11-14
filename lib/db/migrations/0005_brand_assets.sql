CREATE TYPE "public"."brand_asset_kind" AS ENUM('logo', 'template_reference', 'other');--> statement-breakpoint
CREATE TYPE "public"."brand_asset_review_decision" AS ENUM('approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."brand_asset_status" AS ENUM('upload_pending', 'pending_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "brand_asset_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"reviewer_id" text NOT NULL,
	"decision" "brand_asset_review_decision" NOT NULL,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"status" "brand_asset_status" DEFAULT 'upload_pending' NOT NULL,
	"kind" "brand_asset_kind" NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"sha256" text NOT NULL,
	"object_key" text NOT NULL,
	"source_url" text,
	"license" text,
	"alt_text" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "brand_assets_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "brand_assets_org_brand_id_unique" UNIQUE("organization_id","brand_id","id")
);
--> statement-breakpoint
ALTER TABLE "brand_asset_reviews" ADD CONSTRAINT "brand_asset_reviews_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_asset_reviews" ADD CONSTRAINT "brand_asset_reviews_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_asset_reviews" ADD CONSTRAINT "brand_asset_reviews_org_brand_fk" FOREIGN KEY ("organization_id","brand_id") REFERENCES "public"."brands"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_asset_reviews" ADD CONSTRAINT "brand_asset_reviews_asset_fk" FOREIGN KEY ("organization_id","brand_id","asset_id") REFERENCES "public"."brand_assets"("organization_id","brand_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_org_brand_fk" FOREIGN KEY ("organization_id","brand_id") REFERENCES "public"."brands"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_asset_reviews_org_asset_time_idx" ON "brand_asset_reviews" USING btree ("organization_id","asset_id","occurred_at");--> statement-breakpoint
CREATE INDEX "brand_assets_org_brand_created_idx" ON "brand_assets" USING btree ("organization_id","brand_id","created_at");--> statement-breakpoint
CREATE INDEX "brand_assets_org_brand_status_idx" ON "brand_assets" USING btree ("organization_id","brand_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_assets_checksum_identity_unique" ON "brand_assets" USING btree ("organization_id","brand_id","sha256");