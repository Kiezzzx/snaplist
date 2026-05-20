CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"anonymous_session_id" text,
	"original_image_key" text,
	"thumbnail_key" text,
	"image_size" integer,
	"image_status" text DEFAULT 'pending',
	"metadata" jsonb,
	"generated_copies" jsonb,
	"status" text DEFAULT 'draft',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listings_user_created_idx" ON "listings" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "listings_user_status_idx" ON "listings" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "listings_anon_session_idx" ON "listings" USING btree ("anonymous_session_id");