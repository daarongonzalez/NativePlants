import { z } from "zod";
import { lifeCycleSchema, plantFormSchema } from "./plant";

/**
 * Rebate programs, their rules, and the plan a gardener draws in the plot
 * planner. Shared by the import job, the API, the check in the engine and the
 * web app, so all four agree on one shape.
 *
 * Pure, no I/O.
 */

/** Who can settle a rule. `photo_check` is reserved for later. */
export const ruleCheckTypeSchema = z.enum(["plan_check", "owner_confirms", "inspector_only", "photo_check"]);
export type RuleCheckType = z.infer<typeof ruleCheckTypeSchema>;

export const ruleStageSchema = z.enum(["application", "site_visit", "completion", "paperwork"]);
export type RuleStage = z.infer<typeof ruleStageSchema>;

/** The automatic checks the engine knows how to run. A rule names one in `checkKey`. */
export const ruleCheckKeySchema = z.enum([
  "min_area",
  "coverage",
  "lawn_width",
  "hardscape_share",
  "park_strip_height",
  "excluded_materials",
]);
export type RuleCheckKey = z.infer<typeof ruleCheckKeySchema>;

export const rebateRuleSchema = z
  .object({
    code: z.string().regex(/^[A-Z][0-9]{1,2}$/),
    stage: ruleStageSchema,
    checkType: ruleCheckTypeSchema,
    checkKey: ruleCheckKeySchema.nullable(),
    title: z.string().min(1),
    /** The program's own words. Sentences that only pointed to an example file are left out. */
    sourceText: z.string().min(1),
    plainText: z.string().min(1),
    parameters: z.record(z.unknown()).default({}),
  })
  .refine((r) => (r.checkType === "plan_check") === (r.checkKey !== null), {
    message: "a plan_check rule needs a checkKey, and only a plan_check rule may have one",
  });
export type RebateRule = z.infer<typeof rebateRuleSchema>;

export const rebateAreaSchema = z.object({
  communityName: z.string().min(1),
  waterSupplier: z.string().nullable().default(null),
  hasSecondaryWater: z.boolean().nullable().default(null),
});

/** The data file in `data/rebates/`. One file per program. */
export const rebateProgramFileSchema = z.object({
  code: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  utilityName: z.string().min(1),
  perSqftAmount: z.number().positive().nullable(),
  maxAward: z.number().positive().nullable(),
  amountNote: z.string().nullable(),
  requiresPreApproval: z.boolean(),
  requiresPlan: z.boolean(),
  minPlantCoveragePct: z.number().int().min(0).max(100),
  minAreaSqft: z.number().int().positive(),
  completionMonths: z.number().int().positive().nullable(),
  correctionDays: z.number().int().positive().nullable(),
  inspectionBlackoutStart: z.string().regex(/^\d{2}-\d{2}$/).nullable(),
  inspectionBlackoutEnd: z.string().regex(/^\d{2}-\d{2}$/).nullable(),
  payee: z.string().nullable(),
  plantListUrl: z.string().url().nullable(),
  applicationUrl: z.string().url().nullable(),
  status: z.enum(["active", "paused", "closed"]),
  rulesVersion: z.string().min(1),
  sourceUrl: z.string().url(),
  verifiedAt: z.string().date(),
  verifiedBy: z.string().min(1),
  /** Participating communities. Empty means "not listed yet": the app asks the gardener to confirm. */
  areas: z.array(rebateAreaSchema),
  rules: z.array(rebateRuleSchema).min(1),
});
export type RebateProgramFile = z.infer<typeof rebateProgramFileSchema>;

/** What the app needs to know about a program to run a check and explain it. */
export interface RebateProgramSummary {
  code: string;
  name: string;
  utilityName: string;
  perSqftAmount: number | null;
  maxAward: number | null;
  amountNote: string | null;
  minPlantCoveragePct: number;
  minAreaSqft: number;
  completionMonths: number | null;
  correctionDays: number | null;
  inspectionBlackoutStart: string | null;
  inspectionBlackoutEnd: string | null;
  applicationUrl: string | null;
  rulesVersion: string;
  sourceUrl: string;
  verifiedAt: string;
  rules: RebateRule[];
}

/* ------------------------------------------------------------------ *
 * The plan: a yard area drawn on 5 ft squares.
 * ------------------------------------------------------------------ */

/** Each square in the planner is 5 ft by 5 ft. */
export const SQUARE_FT = 5;
export const SQUARE_SQFT = SQUARE_FT * SQUARE_FT;
/** Largest area the planner takes in one go: 4,000 sq ft. Bigger yards are planned one area at a time. */
export const MAX_SQUARES = 160;

export const areaKindSchema = z.enum(["front", "back", "park_strip"]);
export type AreaKind = z.infer<typeof areaKindSchema>;

export const AREA_KIND_LABELS: Record<AreaKind, string> = {
  front: "Front yard",
  back: "Backyard",
  park_strip: "Park strip",
};

/**
 * One square: lawn kept as it is, mulch, pavers (impervious hardscape), or a
 * plant from the planner's list, by id.
 */
export const cellSchema = z.union([
  z.object({ kind: z.literal("lawn") }),
  z.object({ kind: z.literal("mulch") }),
  z.object({ kind: z.literal("pavers") }),
  z.object({ kind: z.literal("plant"), plantId: z.string().min(1).max(64) }),
]);
export type Cell = z.infer<typeof cellSchema>;

export const planLayoutSchema = z
  .object({
    areaKind: areaKindSchema,
    widthFt: z.number().int().min(SQUARE_FT).max(200),
    depthFt: z.number().int().min(SQUARE_FT).max(200),
    cells: z.array(cellSchema),
  })
  .refine((p) => p.widthFt % SQUARE_FT === 0 && p.depthFt % SQUARE_FT === 0, {
    message: `width and depth must be in steps of ${SQUARE_FT} ft`,
  })
  .refine((p) => (p.widthFt / SQUARE_FT) * (p.depthFt / SQUARE_FT) <= MAX_SQUARES, {
    message: `plan at most ${MAX_SQUARES * SQUARE_SQFT} sq ft at a time`,
  })
  .refine((p) => p.cells.length === (p.widthFt / SQUARE_FT) * (p.depthFt / SQUARE_FT), {
    message: "the number of squares does not match the width and depth",
  });
export type PlanLayout = z.infer<typeof planLayoutSchema>;

/** The plant facts a rebate check needs, and nothing else. */
export const planPlantSchema = z.object({
  id: z.string(),
  commonName: z.string(),
  scientificName: z.string(),
  matureHeightCm: z.number().positive(),
  matureWidthCm: z.number().positive(),
  lifeCycle: lifeCycleSchema.nullable(),
  plantForm: plantFormSchema.nullable(),
  staysUnder24In: z.boolean().nullable(),
  reviewStatus: z.enum(["draft", "reviewed", "published"]),
});
export type PlanPlant = z.infer<typeof planPlantSchema>;

/* ------------------------------------------------------------------ *
 * Check results.
 * ------------------------------------------------------------------ */

export const ruleResultSchema = z.enum([
  "pass",
  "warn",
  "fail",
  "not_applicable",
  "owner_to_confirm",
  "inspector_checks",
]);
export type RuleResult = z.infer<typeof ruleResultSchema>;

export interface RuleOutcome {
  code: string;
  title: string;
  stage: RuleStage;
  checkType: RuleCheckType;
  result: RuleResult;
  /** The number the result rests on, when there is one (sq ft, percent). */
  measuredValue: number | null;
  /** One plain sentence on why. */
  note: string;
}

export interface PlantTally {
  plantId: string;
  commonName: string;
  squares: number;
  /** Plants needed to fill those squares at mature spacing. */
  plantCount: number;
}

export interface RebateCheck {
  overall: "likely" | "needs_changes";
  totalSqft: number;
  /** Plants and mulch only: what the program pays on. Pavers and kept lawn are left out. */
  eligibleSqft: number;
  coveragePct: number;
  hardscapePct: number;
  estimatedAmount: number;
  outcomes: RuleOutcome[];
  plants: PlantTally[];
}
