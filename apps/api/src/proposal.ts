import { proposePlan, recommend, type Candidate, type Proposal } from "@np/engine";
import {
  goalsSchema,
  siteProfileSchema,
  type Plant,
  type PlanPlant,
  type RebateProgramSummary,
  type SiteProfile,
} from "@np/shared";
import type { AssembleOutcome } from "./resolve";
import { toDomainProfile } from "./profile";

/**
 * Ranks the planner's plants for a yard and draws a proposed plan.
 *
 * With a full profile (zone, frost, soil, sun), plants are ranked by the
 * scoring engine for that ground, with its plain reasons, and plants it rules
 * out are left out. Without one (no soil survey here, say), plants are taken
 * in the sheet's order and the proposal says so.
 */

/** What Nativo plans for by default: native, water-wise, good for pollinators. */
export const DEFAULT_GOALS = goalsSchema.parse({ pollinators: true, lowWater: true });

export interface ProposalResult {
  proposal: Proposal;
  /** "ground": ranked for this yard's soil and sun. "form": the soil could not be read. */
  rankedBy: "ground" | "form";
}

/** A visitor's assembled profile, as the engine's site profile, or null if a field is missing. */
export function siteProfileFrom(
  assembled: AssembleOutcome,
  place: { latitude: number; longitude: number },
): SiteProfile | null {
  if (!assembled.ok) return null;
  const frost = assembled.detail.frostStation;
  const stored: Record<string, unknown> = {
    ...assembled.values,
    frost: frost
      ? {
          lastSpringP10: frost.lastSpringP10,
          lastSpringP50: frost.lastSpringP50,
          lastSpringP90: frost.lastSpringP90,
          firstFallP10: frost.firstFallP10,
          firstFallP50: frost.firstFallP50,
          firstFallP90: frost.firstFallP90,
          frostFreeDays: frost.frostFreeDays,
        }
      : null,
    provenance: assembled.provenance,
    resolvedAt: new Date().toISOString(),
  };
  const domain = toDomainProfile(stored, place, "00000000-0000-4000-8000-000000000000");
  if ("missing" in domain) return null;
  const parsed = siteProfileSchema.safeParse(domain.profile);
  return parsed.success ? parsed.data : null;
}

export function candidatesFor(profile: SiteProfile | null, catalogue: readonly Plant[], plannerPlants: readonly PlanPlant[]): { candidates: Candidate[]; rankedBy: "ground" | "form" } {
  const byId = new Map(plannerPlants.map((p) => [p.id, p]));
  if (profile) {
    const { recommended } = recommend(profile, catalogue, DEFAULT_GOALS);
    const candidates = recommended.flatMap((r) => {
      const plant = byId.get(r.plant.id);
      return plant ? [{ plant, score: r.score, reason: r.headline }] : [];
    });
    if (candidates.length > 0) return { candidates, rankedBy: "ground" };
  }
  return {
    candidates: plannerPlants.map((plant, i) => ({
      plant,
      score: -i,
      // The proposal's notes say once why these are not ranked; no need to repeat it per plant.
      reason: "",
    })),
    rankedBy: "form",
  };
}

export function drawProposal(
  area: { areaKind: "front" | "back" | "park_strip"; widthFt: number; depthFt: number },
  profile: SiteProfile | null,
  catalogue: readonly Plant[],
  plannerPlants: readonly PlanPlant[],
  program: RebateProgramSummary,
): ProposalResult | null {
  const { candidates, rankedBy } = candidatesFor(profile, catalogue, plannerPlants);
  const proposal = proposePlan(area, candidates, program);
  if (!proposal) return null;
  if (rankedBy === "form") proposal.notes.unshift("We could not read the soil at your address, so plants were chosen for form and size, not ranked for your ground.");
  return { proposal, rankedBy };
}
