CREATE TYPE "public"."social_publication_job_status" AS ENUM('queued', 'processing', 'published', 'failed', 'indeterminate');--> statement-breakpoint
CREATE TABLE "social_publication_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"job_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"outcome" text NOT NULL,
	"error_code" text,
	"external_post_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_publication_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"content_item_id" uuid NOT NULL,
	"approval_request_id" uuid NOT NULL,
	"social_profile_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "social_publication_job_status" DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"locked_at" timestamp with time zone,
	"external_post_id" text,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_approval_requests" ADD COLUMN "social_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "social_publication_attempts" ADD CONSTRAINT "social_publication_attempts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_publication_attempts" ADD CONSTRAINT "social_publication_attempts_job_fk" FOREIGN KEY ("job_id") REFERENCES "public"."social_publication_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_publication_jobs" ADD CONSTRAINT "social_publication_jobs_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_publication_jobs" ADD CONSTRAINT "social_publication_jobs_org_item_brand_fk" FOREIGN KEY ("organization_id","content_item_id","brand_id") REFERENCES "public"."content_items"("organization_id","id","brand_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_publication_jobs" ADD CONSTRAINT "social_publication_jobs_org_approval_fk" FOREIGN KEY ("organization_id","approval_request_id") REFERENCES "public"."content_approval_requests"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_publication_jobs" ADD CONSTRAINT "social_publication_jobs_org_profile_fk" FOREIGN KEY ("organization_id","social_profile_id") REFERENCES "public"."social_profiles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "social_publication_attempts_number_unique" ON "social_publication_attempts" USING btree ("organization_id","job_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "social_publication_jobs_idempotency_unique" ON "social_publication_jobs" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "social_publication_jobs_approval_unique" ON "social_publication_jobs" USING btree ("organization_id","approval_request_id");--> statement-breakpoint
CREATE INDEX "social_publication_jobs_claim_idx" ON "social_publication_jobs" USING btree ("status","next_attempt_at");