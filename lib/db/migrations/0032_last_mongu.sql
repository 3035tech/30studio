CREATE TABLE "background_worker_heartbeats" (
	"worker_key" text PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
