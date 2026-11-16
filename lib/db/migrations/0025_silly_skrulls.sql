CREATE TYPE "public"."social_publication_reconciliation_source" AS ENUM('manual', 'automatic');--> statement-breakpoint
ALTER TABLE "social_publication_reconciliations" ALTER COLUMN "actor_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "social_publication_jobs" ADD COLUMN "provider_reference_id" text;--> statement-breakpoint
ALTER TABLE "social_publication_jobs" ADD COLUMN "reconciliation_attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "social_publication_jobs" ADD COLUMN "next_reconciliation_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "social_publication_reconciliations" ADD COLUMN "source" "social_publication_reconciliation_source" DEFAULT 'manual' NOT NULL;