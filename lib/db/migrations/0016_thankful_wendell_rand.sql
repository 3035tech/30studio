CREATE TABLE "content_approval_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"scope_key" text NOT NULL,
	"brand_id" uuid,
	"required_approvals" integer NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_approval_requests" ADD COLUMN "required_approvals" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "content_approval_policies" ADD CONSTRAINT "content_approval_policies_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_approval_policies" ADD CONSTRAINT "content_approval_policies_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_approval_policies" ADD CONSTRAINT "content_approval_policies_org_brand_fk" FOREIGN KEY ("organization_id","brand_id") REFERENCES "public"."brands"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_approval_policies_org_scope_unique" ON "content_approval_policies" USING btree ("organization_id","scope_key");--> statement-breakpoint
CREATE INDEX "content_approval_policies_org_brand_idx" ON "content_approval_policies" USING btree ("organization_id","brand_id");