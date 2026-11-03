CREATE TABLE "rebate_check_results" (
	"check_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"result" text NOT NULL,
	"measured_value" real,
	"note" text,
	CONSTRAINT "rebate_check_results_check_id_rule_id_pk" PRIMARY KEY("check_id","rule_id")
);
--> statement-breakpoint
CREATE TABLE "rebate_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"rules_version" text NOT NULL,
	"overall" text NOT NULL,
	"eligible_sqft" integer NOT NULL,
	"estimated_amount" numeric,
	"coverage_pct" real,
	"layout" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rebate_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"reported_by" text NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"failed_rule_codes" text[],
	"note" text
);
--> statement-breakpoint
CREATE TABLE "rebate_program_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"community_name" text NOT NULL,
	"water_supplier" text,
	"has_secondary_water" boolean,
	"geom" geometry(MultiPolygon, 4326),
	"source_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rebate_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"area_kind" text NOT NULL,
	"width_ft" integer NOT NULL,
	"depth_ft" integer NOT NULL,
	"zip" text,
	"site_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rebate_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"rules_version" text NOT NULL,
	"code" text NOT NULL,
	"position" integer NOT NULL,
	"stage" text NOT NULL,
	"check_type" text NOT NULL,
	"check_key" text,
	"title" text NOT NULL,
	"source_text" text NOT NULL,
	"plain_text" text NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"verified_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "life_cycle" text;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "plant_form" text;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "stays_under_24in" boolean;--> statement-breakpoint
ALTER TABLE "rebate_programs" ADD COLUMN "code" text;--> statement-breakpoint
-- Any program row written before this migration gets its id as a code, so the
-- NOT NULL below cannot fail on a table that already has rows.
UPDATE "rebate_programs" SET "code" = "id"::text WHERE "code" IS NULL;--> statement-breakpoint
ALTER TABLE "rebate_programs" ALTER COLUMN "code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rebate_programs" ADD COLUMN "amount_note" text;--> statement-breakpoint
ALTER TABLE "rebate_programs" ADD COLUMN "min_area_sqft" integer;--> statement-breakpoint
ALTER TABLE "rebate_programs" ADD COLUMN "completion_months" integer;--> statement-breakpoint
ALTER TABLE "rebate_programs" ADD COLUMN "correction_days" integer;--> statement-breakpoint
ALTER TABLE "rebate_programs" ADD COLUMN "inspection_blackout_start" text;--> statement-breakpoint
ALTER TABLE "rebate_programs" ADD COLUMN "inspection_blackout_end" text;--> statement-breakpoint
ALTER TABLE "rebate_programs" ADD COLUMN "payee" text;--> statement-breakpoint
ALTER TABLE "rebate_programs" ADD COLUMN "application_url" text;--> statement-breakpoint
ALTER TABLE "rebate_programs" ADD COLUMN "rules_version" text DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "rebate_check_results" ADD CONSTRAINT "rebate_check_results_check_id_rebate_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."rebate_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebate_check_results" ADD CONSTRAINT "rebate_check_results_rule_id_rebate_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rebate_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebate_checks" ADD CONSTRAINT "rebate_checks_project_id_rebate_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."rebate_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebate_outcomes" ADD CONSTRAINT "rebate_outcomes_project_id_rebate_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."rebate_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebate_program_areas" ADD CONSTRAINT "rebate_program_areas_program_id_rebate_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."rebate_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebate_projects" ADD CONSTRAINT "rebate_projects_program_id_rebate_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."rebate_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebate_projects" ADD CONSTRAINT "rebate_projects_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebate_rules" ADD CONSTRAINT "rebate_rules_program_id_rebate_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."rebate_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rebate_check_results_rule_idx" ON "rebate_check_results" USING btree ("rule_id","result");--> statement-breakpoint
CREATE INDEX "rebate_checks_project_idx" ON "rebate_checks" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "rebate_outcomes_project_idx" ON "rebate_outcomes" USING btree ("project_id","reported_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rebate_program_areas_name_idx" ON "rebate_program_areas" USING btree ("program_id","community_name");--> statement-breakpoint
CREATE INDEX "rebate_program_areas_geom_idx" ON "rebate_program_areas" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "rebate_projects_program_idx" ON "rebate_projects" USING btree ("program_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rebate_rules_version_code_idx" ON "rebate_rules" USING btree ("program_id","rules_version","code");--> statement-breakpoint
CREATE UNIQUE INDEX "rebate_programs_code_idx" ON "rebate_programs" USING btree ("code");