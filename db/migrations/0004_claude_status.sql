CREATE TABLE "claude_status" (
	"user_id" text PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claude_status" ADD CONSTRAINT "claude_status_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;