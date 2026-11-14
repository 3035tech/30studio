CREATE TYPE "public"."team_audit_action" AS ENUM('member_role_changed', 'member_removed');--> statement-breakpoint
CREATE TABLE "team_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	"action" "team_audit_action" NOT NULL,
	"previous_role" text,
	"new_role" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_audit_events" ADD CONSTRAINT "team_audit_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_audit_events" ADD CONSTRAINT "team_audit_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_audit_events_org_occurred_idx" ON "team_audit_events" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "team_audit_events_org_target_idx" ON "team_audit_events" USING btree ("organization_id","target_user_id");