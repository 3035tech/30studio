ALTER TABLE "campaigns" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_period_check" CHECK ("campaigns"."start_date" is null or "campaigns"."end_date" is null or "campaigns"."end_date" >= "campaigns"."start_date");