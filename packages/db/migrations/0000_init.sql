CREATE TABLE "climate_stations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"geom" geometry(Point, 4326) NOT NULL,
	"elevation_m" real
);
--> statement-breakpoint
CREATE TABLE "data_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" text NOT NULL,
	"record_id" text NOT NULL,
	"source" text NOT NULL,
	"license" text,
	"citation" text,
	"source_url" text,
	"retrieved_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "frost_norms" (
	"station_id" text PRIMARY KEY NOT NULL,
	"last_spring_p10" text NOT NULL,
	"last_spring_p50" text NOT NULL,
	"last_spring_p90" text NOT NULL,
	"first_fall_p10" text NOT NULL,
	"first_fall_p50" text NOT NULL,
	"first_fall_p90" text NOT NULL,
	"frost_free_days" integer NOT NULL,
	"normals_period" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hardiness_zones" (
	"zip" text PRIMARY KEY NOT NULL,
	"zone_ordinal" integer NOT NULL,
	"temp_min_f" real NOT NULL,
	"temp_max_f" real NOT NULL,
	"source_year" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plant_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plant_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"credit" text NOT NULL,
	"license" text NOT NULL,
	"source_url" text,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scientific_name" text NOT NULL,
	"common_names" text[] NOT NULL,
	"family" text NOT NULL,
	"ph_min" real NOT NULL,
	"ph_optimum" real NOT NULL,
	"ph_max" real NOT NULL,
	"sun_min_hours" real NOT NULL,
	"sun_max_hours" real NOT NULL,
	"water_use" text NOT NULL,
	"drainage_tolerated" text[] NOT NULL,
	"zone_min_ordinal" integer NOT NULL,
	"zone_max_ordinal" integer NOT NULL,
	"mature_height_cm" real NOT NULL,
	"mature_width_cm" real NOT NULL,
	"bloom_start_month" integer,
	"bloom_end_month" integer,
	"native_status" text NOT NULL,
	"deer_resistant" boolean DEFAULT false NOT NULL,
	"pollinator_value" text DEFAULT 'none' NOT NULL,
	"edible" boolean DEFAULT false NOT NULL,
	"good_for_cutting" boolean DEFAULT false NOT NULL,
	"toxicity_note" text,
	"market" text NOT NULL,
	"curated_by" text NOT NULL,
	"curated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"review_status" text DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"field" text NOT NULL,
	"reported_value" numeric,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rebate_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"utility_name" text NOT NULL,
	"geom" geometry(MultiPolygon, 4326),
	"per_sqft_amount" numeric,
	"max_award" numeric,
	"requires_pre_approval" boolean DEFAULT true NOT NULL,
	"requires_plan" boolean DEFAULT false NOT NULL,
	"min_plant_coverage_pct" integer,
	"plant_list_url" text,
	"window_open" date,
	"window_close" date,
	"status" text DEFAULT 'active' NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"verified_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_plants" (
	"user_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"plant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_plants_site_id_plant_id_pk" PRIMARY KEY("site_id","plant_id")
);
--> statement-breakpoint
CREATE TABLE "site_constraints" (
	"site_id" uuid PRIMARY KEY NOT NULL,
	"deer_pressure" boolean DEFAULT false NOT NULL,
	"pets" boolean DEFAULT false NOT NULL,
	"young_children" boolean DEFAULT false NOT NULL,
	"irrigation_available" boolean DEFAULT true NOT NULL,
	"hoa_restrictions" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"resolved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"zone_ordinal" integer,
	"frost_station_id" text,
	"mukey" text,
	"ph" real,
	"sand_pct" real,
	"silt_pct" real,
	"clay_pct" real,
	"drainage_class" text,
	"sun_hours_summer" real,
	"provenance" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"address_text" text,
	"geom" geometry(Point, 4326) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "soil_map_units" (
	"mukey" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"survey_area" text NOT NULL,
	"geom" geometry(MultiPolygon, 4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "soil_properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mukey" text NOT NULL,
	"depth_top_cm" integer NOT NULL,
	"depth_bottom_cm" integer NOT NULL,
	"ph" real,
	"sand_pct" real,
	"silt_pct" real,
	"clay_pct" real,
	"organic_matter_pct" real,
	"available_water_capacity" real,
	"drainage_class" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firebase_uid" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'gardener' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "frost_norms" ADD CONSTRAINT "frost_norms_station_id_climate_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."climate_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plant_media" ADD CONSTRAINT "plant_media_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_reports" ADD CONSTRAINT "profile_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_reports" ADD CONSTRAINT "profile_reports_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_plants" ADD CONSTRAINT "saved_plants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_plants" ADD CONSTRAINT "saved_plants_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_plants" ADD CONSTRAINT "saved_plants_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_constraints" ADD CONSTRAINT "site_constraints_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_profiles" ADD CONSTRAINT "site_profiles_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_profiles" ADD CONSTRAINT "site_profiles_frost_station_id_climate_stations_id_fk" FOREIGN KEY ("frost_station_id") REFERENCES "public"."climate_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_profiles" ADD CONSTRAINT "site_profiles_mukey_soil_map_units_mukey_fk" FOREIGN KEY ("mukey") REFERENCES "public"."soil_map_units"("mukey") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soil_properties" ADD CONSTRAINT "soil_properties_mukey_soil_map_units_mukey_fk" FOREIGN KEY ("mukey") REFERENCES "public"."soil_map_units"("mukey") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "climate_stations_geom_idx" ON "climate_stations" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "provenance_record_idx" ON "data_provenance" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "plant_media_plant_idx" ON "plant_media" USING btree ("plant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plants_scientific_market_idx" ON "plants" USING btree ("scientific_name","market");--> statement-breakpoint
CREATE INDEX "plants_market_review_idx" ON "plants" USING btree ("market","review_status");--> statement-breakpoint
CREATE INDEX "profile_reports_site_idx" ON "profile_reports" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "rebate_programs_geom_idx" ON "rebate_programs" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "saved_plants_user_idx" ON "saved_plants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "site_profiles_site_idx" ON "site_profiles" USING btree ("site_id","resolved_at");--> statement-breakpoint
CREATE INDEX "sites_user_idx" ON "sites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sites_geom_idx" ON "sites" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "soil_map_units_geom_idx" ON "soil_map_units" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "soil_properties_mukey_idx" ON "soil_properties" USING btree ("mukey","depth_top_cm");--> statement-breakpoint
CREATE UNIQUE INDEX "users_firebase_uid_idx" ON "users" USING btree ("firebase_uid");