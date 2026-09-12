import { z } from "zod";

/**
 * How sure we are of a value, and where it came from. Every resolved field
 * carries one. A pH read from a county soil survey and a pH read from the
 * gardener's own mail-in test are not the same claim, and the interface must
 * never present them as if they were.
 */
export const provenanceSchema = z.object({
  source: z.enum([
    "ssurgo",
    "statsgo",
    "noaa_normals",
    "usda_phzm",
    "solar_geometry",
    "user_reported",
    "soil_test",
  ]),
  confidence: z.enum(["high", "medium", "low"]),
  retrievedAt: z.string().datetime(),
  note: z.string().optional(),
});
export type Provenance = z.infer<typeof provenanceSchema>;

/** A value plus how we know it. */
export const attributedSchema = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value, provenance: provenanceSchema });

export const drainageClassSchema = z.enum([
  "excessively_drained",
  "somewhat_excessively_drained",
  "well_drained",
  "moderately_well_drained",
  "somewhat_poorly_drained",
  "poorly_drained",
  "very_poorly_drained",
]);
export type DrainageClass = z.infer<typeof drainageClassSchema>;

/**
 * Frost expressed as probability bands rather than a single date. NOAA's
 * normals give 10/50/90 percent thresholds, and a gardener deciding when to
 * plant tomatoes is really choosing a risk tolerance. A single "last frost
 * date" throws that choice away.
 */
export const frostBandsSchema = z.object({
  lastSpringP10: z.string(),
  lastSpringP50: z.string(),
  lastSpringP90: z.string(),
  firstFallP10: z.string(),
  firstFallP50: z.string(),
  firstFallP90: z.string(),
  frostFreeDays: z.number().int(),
});
export type FrostBands = z.infer<typeof frostBandsSchema>;

export const siteConstraintsSchema = z.object({
  deerPressure: z.boolean().default(false),
  pets: z.boolean().default(false),
  youngChildren: z.boolean().default(false),
  irrigationAvailable: z.boolean().default(true),
  hoaRestrictions: z.boolean().default(false),
});
export type SiteConstraints = z.infer<typeof siteConstraintsSchema>;

/**
 * The core domain object: one patch of ground, fully described.
 *
 * This is a SNAPSHOT, not a live view. It records what we knew when it was
 * resolved, which makes recommendations reproducible and lets us tell a
 * gardener their profile has gone stale.
 */
export const siteProfileSchema = z.object({
  siteId: z.string().uuid(),
  resolvedAt: z.string().datetime(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),

  zoneOrdinal: attributedSchema(z.number().int()),
  frost: attributedSchema(frostBandsSchema),

  ph: attributedSchema(z.number().min(0).max(14)),
  sandPct: attributedSchema(z.number().min(0).max(100)),
  siltPct: attributedSchema(z.number().min(0).max(100)),
  clayPct: attributedSchema(z.number().min(0).max(100)),
  drainageClass: attributedSchema(drainageClassSchema),

  sunHoursSummer: attributedSchema(z.number().min(0).max(24)),

  constraints: siteConstraintsSchema,
});
export type SiteProfile = z.infer<typeof siteProfileSchema>;

/** USDA soil texture classes, derived from the sand/silt/clay fractions. */
export type TextureClass =
  | "sand" | "loamy_sand" | "sandy_loam" | "loam" | "silt_loam" | "silt"
  | "sandy_clay_loam" | "clay_loam" | "silty_clay_loam"
  | "sandy_clay" | "silty_clay" | "clay";

/**
 * USDA texture triangle. Order matters — the checks below are arranged so the
 * first match is the correct class, mirroring the triangle's boundaries.
 */
export function textureClass(sand: number, silt: number, clay: number): TextureClass {
  if (clay >= 40 && silt < 40 && sand <= 45) return "clay";
  if (clay >= 40 && silt >= 40) return "silty_clay";
  if (clay >= 35 && sand > 45) return "sandy_clay";
  if (clay >= 27 && clay < 40 && sand > 20 && sand <= 45) return "clay_loam";
  if (clay >= 27 && clay < 40 && sand <= 20) return "silty_clay_loam";
  if (clay >= 20 && clay < 35 && silt < 28 && sand > 45) return "sandy_clay_loam";
  if (silt >= 80 && clay < 12) return "silt";
  if (silt >= 50 && clay < 27) return "silt_loam";
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return "loam";
  if (sand >= 85) return "sand";
  if (sand >= 70) return "loamy_sand";
  return "sandy_loam";
}
