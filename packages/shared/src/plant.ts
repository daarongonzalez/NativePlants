import { z } from "zod";

/**
 * Water use class, aligned to the categories Utah's Localscapes and most
 * Western waterwise programs use. Carried from the first curation pass so a
 * rebate-eligibility view later is not a schema rewrite.
 */
export const waterUseSchema = z.enum(["very_low", "low", "moderate", "high"]);
export type WaterUse = z.infer<typeof waterUseSchema>;

/** Light requirement, expressed as a range of direct sun hours. */
export const sunRequirementSchema = z.object({
  minHours: z.number().min(0).max(24),
  maxHours: z.number().min(0).max(24),
});

export const nativeStatusSchema = z.enum([
  "native",
  "regionally_native",
  "adapted",
  "introduced",
]);
export type NativeStatus = z.infer<typeof nativeStatusSchema>;

/**
 * Rebate fields. Utah's Landscape Incentive Program counts only perennials at
 * the ground plane towards its 50% cover rule (no tree canopy, annuals or
 * bulbs), and park strips allow nothing over 24 inches at maturity, so the
 * catalogue has to say which is which.
 */
export const lifeCycleSchema = z.enum(["perennial", "annual", "biennial", "bulb"]);
export type LifeCycle = z.infer<typeof lifeCycleSchema>;

export const plantFormSchema = z.enum(["groundcover", "wildflower", "grass", "shrub", "tree", "vine"]);
export type PlantForm = z.infer<typeof plantFormSchema>;

/** 24 inches, the park strip height limit, in the catalogue's unit. */
export const PARK_STRIP_MAX_HEIGHT_CM = 61;

/**
 * A curated plant record.
 *
 * Every tolerance is a RANGE with an optimum, not a single value. "Full sun"
 * and "likes acidic soil" are the kind of vague guidance that makes existing
 * plant databases useless for actual matching.
 */
export const plantSchema = z.object({
  id: z.string().uuid(),
  scientificName: z.string(),
  commonNames: z.array(z.string()).min(1),
  family: z.string(),

  phMin: z.number().min(0).max(14),
  phOptimum: z.number().min(0).max(14),
  phMax: z.number().min(0).max(14),

  sun: sunRequirementSchema,
  waterUse: waterUseSchema,

  drainageTolerated: z.array(z.string()).min(1),

  zoneMinOrdinal: z.number().int(),
  zoneMaxOrdinal: z.number().int(),

  matureHeightCm: z.number().positive(),
  matureWidthCm: z.number().positive(),

  /** Null only on drafts that have not been filled in yet. */
  lifeCycle: lifeCycleSchema.nullable(),
  plantForm: plantFormSchema.nullable(),
  /** True only if it stays under 24 inches at maturity without pruning. */
  staysUnder24In: z.boolean().nullable(),

  bloomStartMonth: z.number().int().min(1).max(12).nullable(),
  bloomEndMonth: z.number().int().min(1).max(12).nullable(),

  nativeStatus: nativeStatusSchema,
  deerResistant: z.boolean(),
  pollinatorValue: z.enum(["none", "low", "moderate", "high"]),
  edible: z.boolean(),
  goodForCutting: z.boolean(),

  /** Non-null means we must warn. Never silently omit a toxicity note. */
  toxicityNote: z.string().nullable(),

  curatedBy: z.string(),
  curatedAt: z.string().datetime(),
  reviewStatus: z.enum(["draft", "reviewed", "published"]),
});
export type Plant = z.infer<typeof plantSchema>;

/** What the gardener is trying to achieve. Reweights, never filters. */
export const goalsSchema = z.object({
  pollinators: z.boolean().default(false),
  lowWater: z.boolean().default(false),
  deerResistant: z.boolean().default(false),
  cutFlowers: z.boolean().default(false),
  edible: z.boolean().default(false),
});
export type Goals = z.infer<typeof goalsSchema>;
