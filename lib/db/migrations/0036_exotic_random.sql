ALTER TYPE "public"."competitor_retrieval_method" ADD VALUE 'instagram_graph';--> statement-breakpoint
ALTER TABLE "competitor_sources" ADD COLUMN "external_profile_id" text;--> statement-breakpoint
ALTER TABLE "competitor_sources" ADD COLUMN "social_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "competitor_sources" ADD CONSTRAINT "competitor_sources_org_social_profile_fk" FOREIGN KEY ("organization_id","social_profile_id") REFERENCES "public"."social_profiles"("organization_id","id") ON DELETE restrict ON UPDATE no action;