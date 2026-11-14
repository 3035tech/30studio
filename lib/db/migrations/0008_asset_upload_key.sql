ALTER TABLE "brand_assets" ADD COLUMN "upload_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_upload_key_unique" UNIQUE("upload_key");