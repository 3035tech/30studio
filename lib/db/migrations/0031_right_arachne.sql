CREATE TABLE "dashboard_publication_goals" (
	"organization_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"platform" "social_platform" NOT NULL,
	"monthly_target" integer NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dashboard_publication_goals_org_brand_platform_unique" UNIQUE("organization_id","brand_id","platform"),
	CONSTRAINT "dashboard_publication_goals_monthly_target_check" CHECK ("dashboard_publication_goals"."monthly_target" between 1 and 500)
);
--> statement-breakpoint
ALTER TABLE "dashboard_publication_goals" ADD CONSTRAINT "dashboard_publication_goals_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_publication_goals" ADD CONSTRAINT "dashboard_publication_goals_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_publication_goals" ADD CONSTRAINT "dashboard_publication_goals_org_brand_fk" FOREIGN KEY ("organization_id","brand_id") REFERENCES "public"."brands"("organization_id","id") ON DELETE cascade ON UPDATE no action;