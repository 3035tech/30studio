CREATE TYPE "public"."social_publication_reconciliation_outcome" AS ENUM('published', 'not_published');--> statement-breakpoint
CREATE TABLE "social_publication_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"job_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"outcome" "social_publication_reconciliation_outcome" NOT NULL,
	"evidence" text NOT NULL,
	"external_post_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_publication_reconciliations" ADD CONSTRAINT "social_publication_reconciliations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_publication_reconciliations" ADD CONSTRAINT "social_publication_reconciliations_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_publication_reconciliations" ADD CONSTRAINT "social_publication_reconciliations_job_fk" FOREIGN KEY ("job_id") REFERENCES "public"."social_publication_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "social_publication_reconciliations_org_job_time_idx" ON "social_publication_reconciliations" USING btree ("organization_id","job_id","occurred_at");