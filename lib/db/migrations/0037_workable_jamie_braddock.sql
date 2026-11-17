ALTER TABLE "competitor_sources" DROP CONSTRAINT "competitor_sources_org_social_profile_fk";
--> statement-breakpoint
ALTER TABLE "competitor_sources" ADD CONSTRAINT "competitor_sources_org_brand_social_profile_fk" FOREIGN KEY ("organization_id","brand_id","social_profile_id") REFERENCES "public"."social_profiles"("organization_id","brand_id","id") ON DELETE restrict ON UPDATE no action;