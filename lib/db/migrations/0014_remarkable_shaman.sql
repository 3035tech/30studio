ALTER TABLE "campaigns" ADD COLUMN "idempotency_key" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "request_fingerprint" text;--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_org_creator_idempotency_unique" ON "campaigns" USING btree ("organization_id","created_by","idempotency_key");