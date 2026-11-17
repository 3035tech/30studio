CREATE TYPE "public"."workspace_notification_type" AS ENUM('social_connected', 'social_connection_failed', 'approval_requested', 'publication_failed', 'publication_indeterminate');--> statement-breakpoint
CREATE TABLE "workspace_notification_reads" (
	"organization_id" text NOT NULL,
	"notification_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_notification_reads_org_notification_user_unique" UNIQUE("organization_id","notification_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"recipient_user_id" text,
	"brand_id" uuid,
	"content_item_id" uuid,
	"platform" "social_platform",
	"event_type" "workspace_notification_type" NOT NULL,
	"dedupe_key" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_notifications_org_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "workspace_notification_reads" ADD CONSTRAINT "workspace_notification_reads_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_notification_reads" ADD CONSTRAINT "workspace_notification_reads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_notification_reads" ADD CONSTRAINT "workspace_notification_reads_org_notification_fk" FOREIGN KEY ("organization_id","notification_id") REFERENCES "public"."workspace_notifications"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_notifications" ADD CONSTRAINT "workspace_notifications_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_notifications" ADD CONSTRAINT "workspace_notifications_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_notifications" ADD CONSTRAINT "workspace_notifications_org_brand_fk" FOREIGN KEY ("organization_id","brand_id") REFERENCES "public"."brands"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_notifications" ADD CONSTRAINT "workspace_notifications_org_item_brand_fk" FOREIGN KEY ("organization_id","content_item_id","brand_id") REFERENCES "public"."content_items"("organization_id","id","brand_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_notification_reads_org_user_idx" ON "workspace_notification_reads" USING btree ("organization_id","user_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_notifications_org_dedupe_unique" ON "workspace_notifications" USING btree ("organization_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "workspace_notifications_org_time_idx" ON "workspace_notifications" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "workspace_notifications_user_time_idx" ON "workspace_notifications" USING btree ("organization_id","recipient_user_id","occurred_at");