CREATE TABLE "element" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"layout" text DEFAULT 'callout' NOT NULL,
	"code" text NOT NULL,
	"param_schema" jsonb NOT NULL,
	"default_params" jsonb NOT NULL,
	"fonts" jsonb NOT NULL,
	"default_duration_in_frames" integer NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "element" ADD CONSTRAINT "element_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "element_userId_updatedAt_idx" ON "element" USING btree ("user_id","updated_at");