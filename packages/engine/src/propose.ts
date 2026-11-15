/**
 * The proposed plan: drawing a planting plan for the gardener.
 *
 * Rules, not a black box, like the rest of the engine. Every choice has a
 * plain reason, the same inputs always give the same plan, and the result is
 * checked against the rebate rules before it is handed over.
 *
 * How a plan is drawn:
 *  1. Keep only plants that count towards rebate cover (perennials, not
 *     trees), and in a park strip only those that stay under 24 inches.
 *  2. Pick a few of the best for the ground: one of each form first
 *     (groundcover, wildflower, grass, shrub), then by score, so the plan has
 *     structure and flowers across the season.
 *  3. Lay them out in bands: tallest at the back (row 0, against the house
 *     or fence), lowest at the front (the last row, the street side). Each
 *     band is planted in drifts, not a checkerboard.
 *  4. Plant enough squares for about 60% cover when grown (the rule is 50%;
 *     the margin covers plants that grow smaller than the sheet says), and
 *     mulch the rest: a path through the middle and a gravel edge at the
 *     front.
 *  5. Check the result. If cover falls short, plant mulch squares until it
 *     passes.
 */
import {
  PARK_STRIP_MAX_HEIGHT_CM,
  SQUARE_FT,
  SQUARE_SQFT,
  type AreaKind,
  type Cell,
  type PlanLayout,
  type PlanPlant,
  type RebateCheck,
  type RebateProgramSummary,
} from "@np/shared";
import { checkPlan, countsTowardsCover, coveredSqftPerSquare, plantsForSquares } from "./rebate";

/** A plant offered to the generator, best first, with why it suits this ground. */
export interface Candidate {
  plant: PlanPlant;
  /** Higher is better. Only the order matters. */
  score: number;
  /** One plain sentence: why this plant, here. */
  reason: string;
}

export interface ProposalArea {
  areaKind: AreaKind;
  widthFt: number;
  depthFt: number;
}

export interface PlanPick {
  plantId: string;
  commonName: string;
  scientificName: string;
  reason: string;
  squares: number;
  plantCount: number;
  /** back | middle | front: where it sits in the bed. */
  band: "back" | "middle" | "front";
}

export interface Proposal {
  plan: PlanLayout;
  picks: PlanPick[];
  check: RebateCheck;
  /** Plain notes on choices the gardener should know about. */
  notes: string[];
}

/** The cover the generator aims for, above the program's 50%. */
export const TARGET_COVER_PCT = 60;

const FORM_ORDER = ["shrub", "grass", "wildflower", "groundcover"] as const;

/** How many plants suit an area: a few for a small bed, up to eight. */
export function plantVariety(squares: number): number {
  return Math.max(3, Math.min(8, Math.round(squares / 5)));
}

/** Plants the generator may use in this area. */
export function eligible(candidates: readonly Candidate[], areaKind: AreaKind): Candidate[] {
  return candidates.filter(({ plant }) => {
    if (countsTowardsCover(plant) !== true) return false;
    if (areaKind === "park_strip") {
      return plant.staysUnder24In === true && plant.matureHeightCm <= PARK_STRIP_MAX_HEIGHT_CM;
    }
    return true;
  });
}

const genus = (c: Candidate) => c.plant.scientificName.split(" ")[0]!;

/**
 * One of each form first, in score order, then the best of the rest. A genus
 * repeats only once every other suitable genus is used, so a plan is not
 * three kinds of penstemon.
 */
export function choosePlants(candidates: readonly Candidate[], count: number): Candidate[] {
  const chosen: Candidate[] = [];
  const genera = () => new Set(chosen.map(genus));
  for (const form of FORM_ORDER) {
    const best =
      candidates.find((c) => c.plant.plantForm === form && !chosen.includes(c) && !genera().has(genus(c))) ??
      candidates.find((c) => c.plant.plantForm === form && !chosen.includes(c));
    if (best && chosen.length < count) chosen.push(best);
  }
  for (const newGenusOnly of [true, false]) {
    for (const c of candidates) {
      if (chosen.length >= count) break;
      if (chosen.includes(c) || (newGenusOnly && genera().has(genus(c)))) continue;
      chosen.push(c);
    }
  }
  return chosen;
}

const coverFraction = (p: PlanPlant) => coveredSqftPerSquare(p.matureWidthCm) / SQUARE_SQFT;

export function proposePlan(
  area: ProposalArea,
  candidates: readonly Candidate[],
  program: Pick<RebateProgramSummary, "perSqftAmount" | "maxAward" | "minAreaSqft" | "minPlantCoveragePct" | "rules">,
): Proposal | null {
  const columns = area.widthFt / SQUARE_FT;
  const rows = area.depthFt / SQUARE_FT;
  const total = columns * rows;
  const notes: string[] = [];

  const pool = eligible(candidates, area.areaKind);
  if (pool.length === 0 || total === 0) return null;
  const chosen = choosePlants(pool, Math.min(plantVariety(total), pool.length));

  // Tallest at the back.
  const byHeight = [...chosen].sort((a, b) => b.plant.matureHeightCm - a.plant.matureHeightCm);

  // Mulch first: a path down the middle of a deep, wide bed, and a front edge.
  const cells: Cell[] = Array.from({ length: total }, () => ({ kind: "plant", plantId: "" }) as Cell);
  const isMulch = new Array<boolean>(total).fill(false);
  const avgCover = byHeight.reduce((s, c) => s + coverFraction(c.plant), 0) / byHeight.length;
  const plantSquaresNeeded = Math.min(total, Math.ceil(((TARGET_COVER_PCT / 100) * total) / avgCover));
  let mulchBudget = total - plantSquaresNeeded;

  if (mulchBudget > 0 && rows >= 3 && columns >= 4) {
    const mid = Math.floor(columns / 2);
    for (let r = 0; r < rows && mulchBudget > 0; r++) {
      isMulch[r * columns + mid] = true;
      mulchBudget--;
    }
    notes.push("A mulch path runs through the middle, so you can reach every plant without stepping on them.");
  }
  if (mulchBudget > 0 && rows >= 2) {
    const front = rows - 1;
    for (let c = 0; c < columns && mulchBudget > 0; c++) {
      const i = front * columns + c;
      if (!isMulch[i]) {
        isMulch[i] = true;
        mulchBudget--;
      }
    }
    notes.push("A gravel mulch edge runs along the front, which keeps the bed tidy from the street.");
  }
  // Anything left: every third square, back to front, so the planting has breathing room.
  for (let i = 0; i < total && mulchBudget > 0; i += 3) {
    if (!isMulch[i]) {
      isMulch[i] = true;
      mulchBudget--;
    }
  }

  // Bands of rows for each plant, back to front, in proportion to the plants' count.
  const planted = Array.from({ length: total }, (_, i) => i).filter((i) => !isMulch[i]);
  const bandSize = Math.ceil(planted.length / byHeight.length);
  // Walk rows back to front, and within each row left to right then right to left (drifts, not stripes).
  const order = [...planted].sort((a, b) => {
    const ra = Math.floor(a / columns);
    const rb = Math.floor(b / columns);
    if (ra !== rb) return ra - rb;
    const ca = a % columns;
    const cb = b % columns;
    return ra % 2 === 0 ? ca - cb : cb - ca;
  });
  order.forEach((cell, k) => {
    const plant = byHeight[Math.min(byHeight.length - 1, Math.floor(k / bandSize))]!.plant;
    cells[cell] = { kind: "plant", plantId: plant.id };
  });
  isMulch.forEach((m, i) => {
    if (m) cells[i] = { kind: "mulch" };
  });

  const plants = chosen.map((c) => c.plant);
  let plan: PlanLayout = { areaKind: area.areaKind, widthFt: area.widthFt, depthFt: area.depthFt, cells };
  let check = checkPlan(program, plan, plants);

  // Short of cover? Plant mulch squares (not the path) until it passes.
  const coverCodes = new Set(program.rules.filter((r) => r.checkKey === "coverage").map((r) => r.code));
  const coverRuleFails = () => check.outcomes.some((o) => coverCodes.has(o.code) && o.result === "fail");
  const fillable = cells.map((c, i) => (c.kind === "mulch" ? i : -1)).filter((i) => i >= 0).reverse();
  while (coverRuleFails() && fillable.length > 0) {
    const i = fillable.pop()!;
    const neighbour = plan.cells[i - 1]?.kind === "plant" ? plan.cells[i - 1] : plan.cells[i + 1]?.kind === "plant" ? plan.cells[i + 1] : null;
    const id = neighbour && neighbour.kind === "plant" ? neighbour.plantId : byHeight[byHeight.length - 1]!.plant.id;
    const next = plan.cells.slice();
    next[i] = { kind: "plant", plantId: id };
    plan = { ...plan, cells: next };
    check = checkPlan(program, plan, plants);
  }

  if (area.areaKind === "park_strip") notes.push("Every plant here stays under 24 inches without pruning, as park strips require.");
  if (pool.length < chosen.length + 2) notes.push("Few plants suit this spot, so the choice is narrow. Rachel's review can widen it.");

  const picks: PlanPick[] = byHeight
    .map((c, idx) => {
      const squares = plan.cells.filter((cell) => cell.kind === "plant" && cell.plantId === c.plant.id).length;
      const third = byHeight.length / 3;
      return {
        plantId: c.plant.id,
        commonName: c.plant.commonName,
        scientificName: c.plant.scientificName,
        reason: c.reason,
        squares,
        plantCount: plantsForSquares(squares, c.plant.matureWidthCm),
        band: (idx < third ? "back" : idx < 2 * third ? "middle" : "front") as PlanPick["band"],
      };
    })
    .filter((p) => p.squares > 0);

  return { plan, picks, check, notes };
}
