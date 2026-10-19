CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"format" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"fps" integer DEFAULT 30 NOT NULL,
	"duration_in_frames" integer NOT NULL,
	"doc" jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"thumbnail_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_userId_updatedAt_idx" ON "project" USING btree ("user_id","updated_at");