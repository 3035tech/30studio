CREATE TYPE "public"."social_connection_event_type" AS ENUM('connected', 'refreshed', 'disconnected', 'reauth_required');--> statement-breakpoint
CREATE TABLE "social_connection_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"social_profile_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"platform" "social_platform" NOT NULL,
	"event_type" "social_connection_event_type" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_oauth_states" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"platform" "social_platform" NOT NULL,
	"initiated_by" text NOT NULL,
	"locale" text NOT NULL,
	"code_verifier_ciphertext" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_profile_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"social_profile_id" uuid NOT NULL,
	"access_token_ciphertext" text NOT NULL,
	"refresh_token_ciphertext" text,
	"token_type" text DEFAULT 'Bearer' NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"encryption_key_version" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_profiles" ADD COLUMN "external_account_id" text;--> statement-breakpoint
ALTER TABLE "social_profiles" ADD COLUMN "connected_by" text;--> statement-breakpoint
ALTER TABLE "social_profiles" ADD COLUMN "connected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "social_connection_events" ADD CONSTRAINT "social_connection_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_connection_events" ADD CONSTRAINT "social_connection_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_connection_events" ADD CONSTRAINT "social_connection_events_org_brand_fk" FOREIGN KEY ("organization_id","brand_id") REFERENCES "public"."brands"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_connection_events" ADD CONSTRAINT "social_connection_events_org_profile_fk" FOREIGN KEY ("organization_id","social_profile_id") REFERENCES "public"."social_profiles"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_oauth_states" ADD CONSTRAINT "social_oauth_states_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_oauth_states" ADD CONSTRAINT "social_oauth_states_initiated_by_user_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_oauth_states" ADD CONSTRAINT "social_oauth_states_org_brand_fk" FOREIGN KEY ("organization_id","brand_id") REFERENCES "public"."brands"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_profile_credentials" ADD CONSTRAINT "social_profile_credentials_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_profile_credentials" ADD CONSTRAINT "social_profile_credentials_org_profile_fk" FOREIGN KEY ("organization_id","social_profile_id") REFERENCES "public"."social_profiles"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "social_connection_events_org_brand_time_idx" ON "social_connection_events" USING btree ("organization_id","brand_id","occurred_at");--> statement-breakpoint
CREATE INDEX "social_oauth_states_expiry_idx" ON "social_oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "social_profile_credentials_org_profile_unique" ON "social_profile_credentials" USING btree ("organization_id","social_profile_id");--> statement-breakpoint
CREATE INDEX "social_profile_credentials_expiry_idx" ON "social_profile_credentials" USING btree ("token_expires_at");--> statement-breakpoint
ALTER TABLE "social_profiles" ADD CONSTRAINT "social_profiles_connected_by_user_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "social_profiles_external_identity_unique" ON "social_profiles" USING btree ("organization_id","brand_id","platform","external_account_id");--> statement-breakpoint
ALTER TABLE "social_profiles" ADD CONSTRAINT "social_profiles_org_profile_unique" UNIQUE("organization_id","id");