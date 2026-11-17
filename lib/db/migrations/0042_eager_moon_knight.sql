ALTER TYPE "public"."workspace_notification_type" ADD VALUE 'approval_approved' BEFORE 'publication_failed';--> statement-breakpoint
ALTER TYPE "public"."workspace_notification_type" ADD VALUE 'approval_rejected' BEFORE 'publication_failed';--> statement-breakpoint
ALTER TYPE "public"."workspace_notification_type" ADD VALUE 'approval_changes_requested' BEFORE 'publication_failed';--> statement-breakpoint
ALTER TYPE "public"."workspace_notification_type" ADD VALUE 'publication_succeeded' BEFORE 'publication_failed';