CREATE TYPE "public"."brand_kit_version_status" AS ENUM('draft', 'approved', 'superseded');--> statement-breakpoint
CREATE TABLE "brand_kit_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "brand_kit_version_status" DEFAULT 'draft' NOT NULL,
	"content" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "brand_kit_versions" ADD CONSTRAINT "brand_kit_versions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_kit_versions" ADD CONSTRAINT "brand_kit_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_kit_versions" ADD CONSTRAINT "brand_kit_versions_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_kit_versions" ADD CONSTRAINT "brand_kit_versions_org_brand_fk" FOREIGN KEY ("organization_id","brand_id") REFERENCES "public"."brands"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_kit_versions_identity_unique" ON "brand_kit_versions" USING btree ("organization_id","brand_id","version");--> statement-breakpoint
CREATE INDEX "brand_kit_versions_brand_idx" ON "brand_kit_versions" USING btree ("organization_id","brand_id","version");