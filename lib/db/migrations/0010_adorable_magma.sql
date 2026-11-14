CREATE TABLE "content_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"content_version_id" uuid NOT NULL,
	"platform" "social_platform" NOT NULL,
	"copy" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"content_item_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"canonical_copy" text NOT NULL,
	"brand_kit_version_number" integer,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_versions_org_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "content_variants" ADD CONSTRAINT "content_variants_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_variants" ADD CONSTRAINT "content_variants_org_version_fk" FOREIGN KEY ("organization_id","content_version_id") REFERENCES "public"."content_versions"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_org_brand_fk" FOREIGN KEY ("organization_id","brand_id") REFERENCES "public"."brands"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_org_brand_kit_fk" FOREIGN KEY ("organization_id","brand_id","brand_kit_version_number") REFERENCES "public"."brand_kit_versions"("organization_id","brand_id","version") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_variants_version_platform_unique" ON "content_variants" USING btree ("organization_id","content_version_id","platform");--> statement-breakpoint
CREATE INDEX "content_variants_org_platform_idx" ON "content_variants" USING btree ("organization_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "content_versions_item_number_unique" ON "content_versions" USING btree ("organization_id","content_item_id","version_number");--> statement-breakpoint
CREATE INDEX "content_versions_item_created_idx" ON "content_versions" USING btree ("organization_id","content_item_id","created_at");