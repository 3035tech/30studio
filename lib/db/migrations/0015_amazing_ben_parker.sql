CREATE TYPE "public"."content_approval_decision" AS ENUM('approved', 'rejected', 'changes_requested');--> statement-breakpoint
CREATE TYPE "public"."content_approval_status" AS ENUM('pending', 'approved', 'rejected', 'changes_requested', 'stale');--> statement-breakpoint
CREATE TABLE "content_approval_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"approval_request_id" uuid NOT NULL,
	"reviewer_id" text NOT NULL,
	"decision" "content_approval_decision" NOT NULL,
	"note" text,
	"fingerprint" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"content_item_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"content_version_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"submitted_by" text NOT NULL,
	"status" "content_approval_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "content_approval_requests_org_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "content_approval_decisions" ADD CONSTRAINT "content_approval_decisions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_approval_decisions" ADD CONSTRAINT "content_approval_decisions_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_approval_decisions" ADD CONSTRAINT "content_approval_decisions_org_request_fk" FOREIGN KEY ("organization_id","approval_request_id") REFERENCES "public"."content_approval_requests"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_approval_requests" ADD CONSTRAINT "content_approval_requests_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_approval_requests" ADD CONSTRAINT "content_approval_requests_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_approval_requests" ADD CONSTRAINT "content_approval_requests_org_item_brand_fk" FOREIGN KEY ("organization_id","content_item_id","brand_id") REFERENCES "public"."content_items"("organization_id","id","brand_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_approval_requests" ADD CONSTRAINT "content_approval_requests_org_version_item_brand_fk" FOREIGN KEY ("organization_id","content_version_id","content_item_id","brand_id") REFERENCES "public"."content_versions"("organization_id","id","content_item_id","brand_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_approval_decisions_org_request_reviewer_unique" ON "content_approval_decisions" USING btree ("organization_id","approval_request_id","reviewer_id");--> statement-breakpoint
CREATE INDEX "content_approval_decisions_request_time_idx" ON "content_approval_decisions" USING btree ("organization_id","approval_request_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "content_approval_requests_item_version_unique" ON "content_approval_requests" USING btree ("organization_id","content_item_id","content_version_id");--> statement-breakpoint
CREATE INDEX "content_approval_requests_org_status_created_idx" ON "content_approval_requests" USING btree ("organization_id","status","created_at");