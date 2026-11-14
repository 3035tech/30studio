ALTER TYPE "public"."team_audit_action" ADD VALUE 'invitation_created';--> statement-breakpoint
ALTER TYPE "public"."team_audit_action" ADD VALUE 'invitation_resent';--> statement-breakpoint
ALTER TYPE "public"."team_audit_action" ADD VALUE 'invitation_cancelled';--> statement-breakpoint
ALTER TYPE "public"."team_audit_action" ADD VALUE 'invitation_accepted';--> statement-breakpoint
ALTER TYPE "public"."team_audit_action" ADD VALUE 'invitation_delivery_failed';--> statement-breakpoint
ALTER TABLE "team_audit_events" ALTER COLUMN "target_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "team_audit_events" ADD COLUMN "target_email" text;--> statement-breakpoint
ALTER TABLE "team_audit_events" ADD COLUMN "invitation_id" text;