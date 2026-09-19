import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { multiPolygon, point } from "./geometry";

/* ------------------------------------------------------------------ *
 * Reference tables — written only by scheduled ingestion, never by a
 * user request. If an upstream source is down these go stale; nothing
 * user-facing breaks.
 * ------------------------------------------------------------------ */

/**
 * Where every reference claim came from. Not optional: GBIF licences vary per
 * dataset, and we must be able to answer "where did this come from" for any
 * row in the system.
 */
export const dataProvenance = pgTable(
  "data_provenance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tableName: text("table_name").notNull(),
    recordId: text("record_id").notNull(),
    source: text("source").notNull(),
    license: text("license"),
    citation: text("citation"),
    sourceUrl: text("source_url"),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("provenance_record_idx").on(t.tableName, t.recordId)],
);

export const hardinessZones = pgTable("hardiness_zones", {
  zip: text("zip").primaryKey(),
  zoneOrdinal: integer("zone_ordinal").notNull(),
  tempMinF: real("temp_min_f").notNull(),
  tempMaxF: real("temp_max_f").notNull(),
  sourceYear: integer("source_year").notNull(),
});

export const climateStations = pgTable(
  "climate_stations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    geom: point("geom").notNull(),
    elevationM: real("elevation_m"),
  },
  (t) => [index("climate_stations_geom_idx").using("gist", t.geom)],
);

/**
 * Frost as probability bands, not a single date. A gardener deciding when to
 * plant is choosing a risk tolerance; one "last frost date" throws that away.
 * Dates stored as MM-DD text since they recur annually.
 */
export const frostNorms = pgTable("frost_norms", {
  stationId: text("station_id").primaryKey().references(() => climateStations.id),
  lastSpringP10: text("last_spring_p10").notNull(),
  lastSpringP50: text("last_spring_p50").notNull(),
  lastSpringP90: text("last_spring_p90").notNull(),
  firstFallP10: text("first_fall_p10").notNull(),
  firstFallP50: text("first_fall_p50").notNull(),
  firstFallP90: text("first_fall_p90").notNull(),
  frostFreeDays: integer("frost_free_days").notNull(),
  normalsPeriod: text("normals_period").notNull(),
});

export const soilMapUnits = pgTable(
  "soil_map_units",
  {
    mukey: text("mukey").primaryKey(),
    name: text("name").notNull(),
    surveyArea: text("survey_area").notNull(),
    geom: multiPolygon("geom").notNull(),
  },
  (t) => [index("soil_map_units_geom_idx").using("gist", t.geom)],
);

/** One horizon of one map unit. SSURGO depths are metric. */
export const soilProperties = pgTable(
  "soil_properties",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mukey: text("mukey").notNull().references(() => soilMapUnits.mukey),
    depthTopCm: integer("depth_top_cm").notNull(),
    depthBottomCm: integer("depth_bottom_cm").notNull(),
    ph: real("ph"),
    sandPct: real("sand_pct"),
    siltPct: real("silt_pct"),
    clayPct: real("clay_pct"),
    organicMatterPct: real("organic_matter_pct"),
    availableWaterCapacity: real("available_water_capacity"),
    drainageClass: text("drainage_class"),
  },
  (t) => [index("soil_properties_mukey_idx").on(t.mukey, t.depthTopCm)],
);

/**
 * The curated plant catalogue. The slowest asset to build and the only
 * durable moat — the software is copyable, this is not.
 *
 * Water use and mature dimensions are carried from the first curation pass
 * so a rebate-compliance view later (Localscapes requires 50% plant coverage
 * at maturity) is not a schema rewrite.
 */
export const plants = pgTable(
  "plants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scientificName: text("scientific_name").notNull(),
    commonNames: text("common_names").array().notNull(),
    family: text("family").notNull(),

    phMin: real("ph_min").notNull(),
    phOptimum: real("ph_optimum").notNull(),
    phMax: real("ph_max").notNull(),

    sunMinHours: real("sun_min_hours").notNull(),
    sunMaxHours: real("sun_max_hours").notNull(),

    waterUse: text("water_use").notNull(),
    drainageTolerated: text("drainage_tolerated").array().notNull(),

    zoneMinOrdinal: integer("zone_min_ordinal").notNull(),
    zoneMaxOrdinal: integer("zone_max_ordinal").notNull(),

    matureHeightCm: real("mature_height_cm").notNull(),
    matureWidthCm: real("mature_width_cm").notNull(),

    bloomStartMonth: integer("bloom_start_month"),
    bloomEndMonth: integer("bloom_end_month"),

    nativeStatus: text("native_status").notNull(),
    deerResistant: boolean("deer_resistant").notNull().default(false),
    pollinatorValue: text("pollinator_value").notNull().default("none"),
    edible: boolean("edible").notNull().default(false),
    goodForCutting: boolean("good_for_cutting").notNull().default(false),

    /** Non-null means we must warn. Never silently omit. */
    toxicityNote: text("toxicity_note"),

    /** Which market's curation pass produced this row. */
    market: text("market").notNull(),

    curatedBy: text("curated_by").notNull(),
    curatedAt: timestamp("curated_at", { withTimezone: true }).notNull().defaultNow(),
    reviewStatus: text("review_status").notNull().default("draft"),
  },
  (t) => [
    uniqueIndex("plants_scientific_market_idx").on(t.scientificName, t.market),
    index("plants_market_review_idx").on(t.market, t.reviewStatus),
  ],
);

/** Licence and credit travel with every image. CC images require attribution. */
export const plantMedia = pgTable(
  "plant_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    plantId: uuid("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    credit: text("credit").notNull(),
    license: text("license").notNull(),
    sourceUrl: text("source_url"),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (t) => [index("plant_media_plant_idx").on(t.plantId)],
);

/* ------------------------------------------------------------------ *
 * User tables. Every one of these carries an owner, and every query
 * against them goes through a repository function that requires it.
 * ------------------------------------------------------------------ */

/**
 * Application data references `users.id`, never the Firebase UID directly.
 * That indirection is what keeps the auth provider swappable.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    firebaseUid: text("firebase_uid").notNull(),
    email: text("email").notNull(),
    /** Postgres is the source of truth for roles. A custom claim can be an hour stale. */
    role: text("role").notNull().default("gardener"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_firebase_uid_idx").on(t.firebaseUid)],
);

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    addressText: text("address_text"),
    geom: point("geom").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sites_user_idx").on(t.userId),
    index("sites_geom_idx").using("gist", t.geom),
  ],
);

/**
 * A snapshot of what we knew when it was resolved, not a live view. Keeps
 * recommendations reproducible and lets us tell a gardener their profile is
 * six months stale.
 */
export const siteProfiles = pgTable(
  "site_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }).notNull().defaultNow(),

    zoneOrdinal: integer("zone_ordinal"),
    frostStationId: text("frost_station_id").references(() => climateStations.id),
    mukey: text("mukey").references(() => soilMapUnits.mukey),

    ph: real("ph"),
    sandPct: real("sand_pct"),
    siltPct: real("silt_pct"),
    clayPct: real("clay_pct"),
    drainageClass: text("drainage_class"),
    sunHoursSummer: real("sun_hours_summer"),

    /** Per-field source and confidence. Shape defined in @np/shared. */
    provenance: jsonb("provenance").notNull(),
  },
  (t) => [index("site_profiles_site_idx").on(t.siteId, t.resolvedAt)],
);

export const siteConstraints = pgTable("site_constraints", {
  siteId: uuid("site_id").primaryKey().references(() => sites.id, { onDelete: "cascade" }),
  deerPressure: boolean("deer_pressure").notNull().default(false),
  pets: boolean("pets").notNull().default(false),
  youngChildren: boolean("young_children").notNull().default(false),
  irrigationAvailable: boolean("irrigation_available").notNull().default(true),
  hoaRestrictions: boolean("hoa_restrictions").notNull().default(false),
});

export const savedPlants = pgTable(
  "saved_plants",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    plantId: uuid("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.plantId] }), index("saved_plants_user_idx").on(t.userId)],
);

/**
 * A gardener telling us the profile is wrong. The most valuable data we
 * collect and the one thing no competitor is gathering.
 */
export const profileReports = pgTable(
  "profile_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    reportedValue: numeric("reported_value"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("profile_reports_site_idx").on(t.siteId)],
);

/** Unused in V1 beyond a display field; shape fixed now so it is not a rewrite. */
export const rebatePrograms = pgTable(
  "rebate_programs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    utilityName: text("utility_name").notNull(),
    geom: multiPolygon("geom"),
    perSqftAmount: numeric("per_sqft_amount"),
    maxAward: numeric("max_award"),
    requiresPreApproval: boolean("requires_pre_approval").notNull().default(true),
    requiresPlan: boolean("requires_plan").notNull().default(false),
    minPlantCoveragePct: integer("min_plant_coverage_pct"),
    plantListUrl: text("plant_list_url"),
    windowOpen: date("window_open"),
    windowClose: date("window_close"),
    status: text("status").notNull().default("active"),
    sourceUrl: text("source_url").notNull(),
    /** Never show an amount without saying when we last checked. */
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    verifiedBy: text("verified_by").notNull(),
  },
  (t) => [index("rebate_programs_geom_idx").using("gist", t.geom)],
);
