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

    /** perennial | annual | biennial | bulb. Only perennials count towards rebate cover. */
    lifeCycle: text("life_cycle"),
    /** groundcover | wildflower | grass | shrub | tree | vine. Tree canopy does not count. */
    plantForm: text("plant_form"),
    /** Stays under 24 inches at maturity without pruning: the park strip rule. */
    staysUnder24In: boolean("stays_under_24in"),

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
    /**
     * How sunny the gardener says this spot is: full, part or shade. Null means
     * they have not said, and the profile falls back to a calculated value.
     */
    sunExposure: text("sun_exposure"),
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

/* ------------------------------------------------------------------ *
 * Rebates, layer one: what a program says must be true.
 *
 * Written by the rebate import job from a file in git
 * (data/rebates/), never by a request. Every row carries where it came from
 * and when we last checked, because a rebate amount a gardener trusts has a
 * financial consequence.
 * ------------------------------------------------------------------ */

export const rebatePrograms = pgTable(
  "rebate_programs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Stable key used by the app and the data file, e.g. "ut-landscape-incentive". */
    code: text("code").notNull(),
    name: text("name").notNull(),
    utilityName: text("utility_name").notNull(),
    geom: multiPolygon("geom"),
    perSqftAmount: numeric("per_sqft_amount"),
    maxAward: numeric("max_award"),
    /** Plain words on how the amount varies, e.g. by local water supplier. */
    amountNote: text("amount_note"),
    requiresPreApproval: boolean("requires_pre_approval").notNull().default(true),
    requiresPlan: boolean("requires_plan").notNull().default(false),
    minPlantCoveragePct: integer("min_plant_coverage_pct"),
    minAreaSqft: integer("min_area_sqft"),
    /** Months from the first site visit to finish the project. */
    completionMonths: integer("completion_months"),
    /** Days allowed to correct a failed final inspection without penalty. */
    correctionDays: integer("correction_days"),
    /** Month-day, e.g. "10-15". Inspections are usually unavailable in this window. */
    inspectionBlackoutStart: text("inspection_blackout_start"),
    inspectionBlackoutEnd: text("inspection_blackout_end"),
    payee: text("payee"),
    plantListUrl: text("plant_list_url"),
    applicationUrl: text("application_url"),
    windowOpen: date("window_open"),
    windowClose: date("window_close"),
    status: text("status").notNull().default("active"),
    /** Bumped whenever the rules change. Old checks keep the version they ran against. */
    rulesVersion: text("rules_version").notNull().default("1"),
    sourceUrl: text("source_url").notNull(),
    /** Never show an amount without saying when we last checked. */
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    verifiedBy: text("verified_by").notNull(),
  },
  (t) => [
    uniqueIndex("rebate_programs_code_idx").on(t.code),
    index("rebate_programs_geom_idx").using("gist", t.geom),
  ],
);

/**
 * Who a program covers. In Utah that is a list of participating communities
 * and their water suppliers; shapes are added when a reliable source exists.
 */
export const rebateProgramAreas = pgTable(
  "rebate_program_areas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    programId: uuid("program_id")
      .notNull()
      .references(() => rebatePrograms.id, { onDelete: "cascade" }),
    communityName: text("community_name").notNull(),
    waterSupplier: text("water_supplier"),
    /** Inspections are seasonal where secondary (untreated) irrigation water is used. */
    hasSecondaryWater: boolean("has_secondary_water"),
    geom: multiPolygon("geom"),
    sourceUrl: text("source_url").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("rebate_program_areas_name_idx").on(t.programId, t.communityName),
    index("rebate_program_areas_geom_idx").using("gist", t.geom),
  ],
);

/**
 * One row per rule, word for word from the program, with a plain-language
 * version and who can check it:
 *
 *  - plan_check:     we can work it out from the plan
 *  - owner_confirms: only the owner knows
 *  - inspector_only: only the final visit settles it
 *  - photo_check:    reserved for later, when a photo can settle it
 *
 * `parameters` holds the numbers (minimum area, cover share, heights), so a
 * program change is a data edit, not a code change.
 */
export const rebateRules = pgTable(
  "rebate_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    programId: uuid("program_id")
      .notNull()
      .references(() => rebatePrograms.id, { onDelete: "cascade" }),
    rulesVersion: text("rules_version").notNull(),
    /** Stable within a program, e.g. "E6" (eligibility 6) or "C2" (completion 2). */
    code: text("code").notNull(),
    position: integer("position").notNull(),
    /** application | site_visit | completion | paperwork */
    stage: text("stage").notNull(),
    checkType: text("check_type").notNull(),
    /** Which automatic check reads this rule, if any, e.g. "min_area". */
    checkKey: text("check_key"),
    title: text("title").notNull(),
    sourceText: text("source_text").notNull(),
    plainText: text("plain_text").notNull(),
    parameters: jsonb("parameters").notNull().default({}),
    sourceUrl: text("source_url").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    verifiedBy: text("verified_by").notNull(),
  },
  (t) => [uniqueIndex("rebate_rules_version_code_idx").on(t.programId, t.rulesVersion, t.code)],
);

/* ------------------------------------------------------------------ *
 * Rebates, layer two: the tracker.
 *
 * What happens to each plan, for our own reporting. Anonymous by design: no
 * address, no email, no user. A project is one area of one yard (front, back
 * or park strip). A check is one press of "Check my plan". Outcomes come
 * later, from the owner (follow-up emails) or the program, if it shares them.
 * ------------------------------------------------------------------ */

export const rebateProjects = pgTable(
  "rebate_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    programId: uuid("program_id")
      .notNull()
      .references(() => rebatePrograms.id),
    /** front | back | park_strip */
    areaKind: text("area_kind").notNull(),
    widthFt: integer("width_ft").notNull(),
    depthFt: integer("depth_ft").notNull(),
    /** ZIP only, for reporting by area. Never the street address. */
    zip: text("zip"),
    /** Set later if a signed-in gardener saves the project. Null while anonymous. */
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rebate_projects_program_idx").on(t.programId, t.createdAt)],
);

export const rebateChecks = pgTable(
  "rebate_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => rebateProjects.id, { onDelete: "cascade" }),
    rulesVersion: text("rules_version").notNull(),
    /** likely | needs_changes */
    overall: text("overall").notNull(),
    eligibleSqft: integer("eligible_sqft").notNull(),
    estimatedAmount: numeric("estimated_amount"),
    coveragePct: real("coverage_pct"),
    /** The plan as checked (the grid and the plants), so a check can be replayed. */
    layout: jsonb("layout").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rebate_checks_project_idx").on(t.projectId, t.createdAt)],
);

export const rebateCheckResults = pgTable(
  "rebate_check_results",
  {
    checkId: uuid("check_id")
      .notNull()
      .references(() => rebateChecks.id, { onDelete: "cascade" }),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => rebateRules.id),
    /** pass | warn | fail | owner_to_confirm | inspector_checks */
    result: text("result").notNull(),
    measuredValue: real("measured_value"),
    note: text("note"),
  },
  (t) => [
    primaryKey({ columns: [t.checkId, t.ruleId] }),
    index("rebate_check_results_rule_idx").on(t.ruleId, t.result),
  ],
);

export const rebateOutcomes = pgTable(
  "rebate_outcomes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => rebateProjects.id, { onDelete: "cascade" }),
    /** applied | site_visit_approved | site_visit_declined | completed | final_passed | final_failed | corrected | paid | withdrawn */
    stage: text("stage").notNull(),
    /** owner | program */
    reportedBy: text("reported_by").notNull(),
    reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
    /** Rule codes the program said were not met, when a stage failed. */
    failedRuleCodes: text("failed_rule_codes").array(),
    note: text("note"),
  },
  (t) => [index("rebate_outcomes_project_idx").on(t.projectId, t.reportedAt)],
);
