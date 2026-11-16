CREATE TYPE "public"."competitor_observation_analysis_status" AS ENUM('pending', 'processing', 'ready', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."competitor_topic" AS ENUM('product_news', 'education', 'customer_story', 'promotion', 'event', 'industry_news', 'opinion', 'other');--> statement-breakpoint
ALTER TABLE "competitor_observations" ADD COLUMN "analysis_status" "competitor_observation_analysis_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "competitor_observations" ADD COLUMN "analysis_locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "competitor_observations" ADD COLUMN "analysis_next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "competitor_observations" ADD COLUMN "analysis_attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "competitor_observations" ADD COLUMN "analysis_error_code" text;--> statement-breakpoint
ALTER TABLE "competitor_observations" ADD COLUMN "analysis_model" text;--> statement-breakpoint
ALTER TABLE "competitor_observations" ADD COLUMN "topic" "competitor_topic";--> statement-breakpoint
ALTER TABLE "competitor_observations" ADD COLUMN "observed_pattern_en" text;--> statement-breakpoint
ALTER TABLE "competitor_observations" ADD COLUMN "observed_pattern_pt" text;--> statement-breakpoint
ALTER TABLE "competitor_observations" ADD COLUMN "editorial_opportunity_en" text;--> statement-breakpoint
ALTER TABLE "competitor_observations" ADD COLUMN "editorial_opportunity_pt" text;--> statement-breakpoint
CREATE INDEX "competitor_observations_analysis_queue_idx" ON "competitor_observations" USING btree ("analysis_status","analysis_next_attempt_at","analysis_locked_at");