ALTER TABLE "content_media_assets" ADD COLUMN "carousel_id" uuid;--> statement-breakpoint
ALTER TABLE "content_media_assets" ADD COLUMN "page_number" integer;--> statement-breakpoint
ALTER TABLE "content_media_assets" ADD COLUMN "page_count" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "content_media_carousel_page_unique" ON "content_media_assets" USING btree ("organization_id","carousel_id","page_number");