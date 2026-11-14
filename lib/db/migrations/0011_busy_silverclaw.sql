CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"title" text NOT NULL,
	"brief" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_org_id_brand_unique" UNIQUE("organization_id","id","brand_id")
);
--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_org_brand_fk" FOREIGN KEY ("organization_id","brand_id") REFERENCES "public"."brands"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_org_brand_created_idx" ON "campaigns" USING btree ("organization_id","brand_id","created_at");--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_org_campaign_brand_fk" FOREIGN KEY ("organization_id","campaign_id","brand_id") REFERENCES "public"."campaigns"("organization_id","id","brand_id") ON DELETE cascade ON UPDATE no action;