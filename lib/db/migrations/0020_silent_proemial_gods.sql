ALTER TABLE "social_connection_events" DROP CONSTRAINT "social_connection_events_actor_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "social_connection_events" ALTER COLUMN "actor_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "social_connection_events" ADD CONSTRAINT "social_connection_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;