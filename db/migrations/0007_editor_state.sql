CREATE TABLE "editor_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"selected_clip_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "editor_state" ADD CONSTRAINT "editor_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_state" ADD CONSTRAINT "editor_state_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;