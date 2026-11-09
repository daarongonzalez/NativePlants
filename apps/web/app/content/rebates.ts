/**
 * The rebate programs the content pages describe.
 *
 * These read the same file the database is loaded from
 * (data/rebates/*.json), so the program page and the FAQ cannot drift from
 * the rules the plan check uses. Change a rule there, reload the database,
 * and redeploy the web app: both move together.
 */
import type { RuleCheckType, RuleStage } from "@np/shared";
import utahFile from "../../../../data/rebates/ut-landscape-incentive.json";
import { formatMonthDay } from "../lib/flow";

export interface ProgramRule {
  code: string;
  stage: RuleStage;
  checkType: RuleCheckType;
  title: string;
  sourceText: string;
  plainText: string;
}

export interface ProgramFile {
  code: string;
  name: string;
  utilityName: string;
  perSqftAmount: number | null;
  maxAward: number | null;
  amountNote: string | null;
  requiresPreApproval: boolean;
  minPlantCoveragePct: number;
  minAreaSqft: number;
  completionMonths: number | null;
  correctionDays: number | null;
  inspectionBlackoutStart: string | null;
  inspectionBlackoutEnd: string | null;
  payee: string | null;
  applicationUrl: string | null;
  rulesVersion: string;
  sourceUrl: string;
  verifiedAt: string;
  rules: ProgramRule[];
}

/** A program as the content pages present it: the file, plus where it applies and its page. */
export interface ProgramPage {
  slug: string;
  /** Where it applies, in plain words: "Utah". */
  place: string;
  /** Where Nativo's planner supports it. */
  inPlanner: boolean;
  program: ProgramFile;
}

export const UTAH: ProgramPage = {
  slug: "utah",
  place: "Utah",
  inPlanner: true,
  program: utahFile as unknown as ProgramFile,
};

/** Every program with a page. One today; more as regions open. */
export const PROGRAMS: ProgramPage[] = [UTAH];

export const programBySlug = (slug: string | undefined) => PROGRAMS.find((p) => p.slug === slug) ?? null;

export const STAGE_ORDER: RuleStage[] = ["application", "site_visit", "completion", "paperwork"];

export const STAGE_TITLES: Record<RuleStage, string> = {
  application: "When you apply",
  site_visit: "At the first site visit",
  completion: "When you finish",
  paperwork: "Before you are paid",
};

/** Who settles each rule, in plain words. */
export const CHECK_LABELS: Record<RuleCheckType, string> = {
  plan_check: "Nativo checks this from your plan",
  owner_confirms: "You confirm this",
  inspector_only: "The inspector checks this",
  photo_check: "A photo settles this",
};

export function rulesByStage(program: ProgramFile) {
  return STAGE_ORDER.map((stage) => ({ stage, rules: program.rules.filter((r) => r.stage === stage) })).filter(
    (g) => g.rules.length > 0,
  );
}

export const ruleByCode = (program: ProgramFile, code: string) => program.rules.find((r) => r.code === code) ?? null;

/** "$2.00 a sq ft", or a plain sentence when the rate is not set. */
export function rateText(program: ProgramFile): string {
  if (program.perSqftAmount === null) return "a rate set by your water supplier";
  return `$${program.perSqftAmount.toFixed(2)} a sq ft`;
}

/** "15 Oct to 15 Apr", or null. */
export function blackoutText(program: ProgramFile): string | null {
  if (!program.inspectionBlackoutStart || !program.inspectionBlackoutEnd) return null;
  return `${formatMonthDay(program.inspectionBlackoutStart)} to ${formatMonthDay(program.inspectionBlackoutEnd)}`;
}

/** What a lawn of a given size could earn, before any cap. */
export const exampleAmount = (program: ProgramFile, sqft: number) =>
  program.perSqftAmount === null ? null : Math.round(program.perSqftAmount * sqft);
