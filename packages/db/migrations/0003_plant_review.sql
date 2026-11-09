CREATE TABLE "plant_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plant_id" uuid NOT NULL,
	"reviewer_email" text NOT NULL,
	"decision" text NOT NULL,
	"notes" text,
	"sprite_check" text,
	"facts_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plant_media" ALTER COLUMN "r2_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "plant_media" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "plant_media" ADD COLUMN "source_photo_id" text;--> statement-breakpoint
ALTER TABLE "plant_media" ADD COLUMN "remote_url" text;--> statement-breakpoint
ALTER TABLE "plant_media" ADD COLUMN "thumb_url" text;--> statement-breakpoint
ALTER TABLE "plant_media" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "plant_media" ADD COLUMN "review_status" text DEFAULT 'candidate' NOT NULL;--> statement-breakpoint
ALTER TABLE "plant_media" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "plant_media" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "plant_media" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "facts_hash" text;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plant_reviews" ADD CONSTRAINT "plant_reviews_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plant_reviews_plant_idx" ON "plant_reviews" USING btree ("plant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plant_media_source_idx" ON "plant_media" USING btree ("plant_id","source","source_photo_id");