DROP INDEX "brand_assets_checksum_identity_unique";--> statement-breakpoint
CREATE INDEX "brand_assets_checksum_identity_idx" ON "brand_assets" USING btree ("organization_id","brand_id","sha256");