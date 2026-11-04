/**
 * The plot planner game: state changes and Sage's lines. No React, so the
 * rules of the game can be tested on their own. The rebate check itself lives
 * in @np/engine and is shared with the API.
 */
import {
  MAX_SQUARES,
  SQUARE_FT,
  type AreaKind,
  type Cell,
  type PlanLayout,
  type PlanPlant,
  type RebateCheck,
} from "@np/shared";

/** What the brush paints: a material, or a plant by id. */
export type Brush = { kind: "lawn" } | { kind: "mulch" } | { kind: "pavers" } | { kind: "plant"; plantId: string };

export const MIN_SIDE_FT = SQUARE_FT;
export const MAX_SIDE_FT = 80;

export interface Plan {
  areaKind: AreaKind;
  widthFt: number;
  depthFt: number;
  cells: Cell[];
}

export const DEFAULT_SIZE: Record<AreaKind, { widthFt: number; depthFt: number }> = {
  front: { widthFt: 30, depthFt: 20 },
  back: { widthFt: 40, depthFt: 25 },
  park_strip: { widthFt: 40, depthFt: 5 },
};

export function newPlan(areaKind: AreaKind): Plan {
  const { widthFt, depthFt } = DEFAULT_SIZE[areaKind];
  return { areaKind, widthFt, depthFt, cells: lawn((widthFt / SQUARE_FT) * (depthFt / SQUARE_FT)) };
}

const lawn = (n: number): Cell[] => Array.from({ length: n }, () => ({ kind: "lawn" }) as Cell);

const sameCell = (a: Cell, b: Brush) =>
  a.kind === b.kind && (a.kind !== "plant" || (b.kind === "plant" && a.plantId === b.plantId));

/** Tap a square. The same brush again puts lawn back, so a tap can always be undone. */
export function paint(plan: Plan, index: number, brush: Brush): Plan {
  const cells = plan.cells.slice();
  const current = cells[index];
  if (!current) return plan;
  cells[index] = sameCell(current, brush) ? { kind: "lawn" } : ({ ...brush } as Cell);
  return { ...plan, cells };
}

/** Paint every lawn square with the brush. */
export function fillLawn(plan: Plan, brush: Brush): Plan {
  return { ...plan, cells: plan.cells.map((c) => (c.kind === "lawn" ? ({ ...brush } as Cell) : c)) };
}

/** Grow or shrink the area, keeping what is painted where it still fits. */
export function resize(plan: Plan, widthFt: number, depthFt: number): Plan {
  const w = clampSide(widthFt);
  let d = clampSide(depthFt);
  const cols = w / SQUARE_FT;
  while (cols * (d / SQUARE_FT) > MAX_SQUARES && d > MIN_SIDE_FT) d -= SQUARE_FT;
  const rows = d / SQUARE_FT;

  const oldCols = plan.widthFt / SQUARE_FT;
  const oldRows = plan.cells.length / oldCols;
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(r < oldRows && c < oldCols ? plan.cells[r * oldCols + c]! : { kind: "lawn" });
    }
  }
  return { ...plan, widthFt: w, depthFt: d, cells };
}

/** Whether one more step in a direction would go over the planner's size limit. */
export function canGrow(plan: Plan, side: "width" | "depth"): boolean {
  const w = plan.widthFt + (side === "width" ? SQUARE_FT : 0);
  const d = plan.depthFt + (side === "depth" ? SQUARE_FT : 0);
  return w <= MAX_SIDE_FT && d <= MAX_SIDE_FT && (w / SQUARE_FT) * (d / SQUARE_FT) <= MAX_SQUARES;
}

function clampSide(ft: number): number {
  const stepped = Math.round(ft / SQUARE_FT) * SQUARE_FT;
  return Math.min(MAX_SIDE_FT, Math.max(MIN_SIDE_FT, stepped));
}

export const toLayout = (plan: Plan): PlanLayout => ({ ...plan });

/** Seed colours are data: one per plant form, from the planner's tokens. */
export const FORM_COLOR: Record<string, string> = {
  wildflower: "--seed-penstemon",
  groundcover: "--seed-buckwheat",
  grass: "--seed-flax",
  shrub: "--seed-globemallow",
  tree: "--green",
  vine: "--seed-globemallow",
};

export const plantColor = (plant: PlanPlant) => FORM_COLOR[plant.plantForm ?? ""] ?? "--seed-penstemon";

/** A short tag for a tile: the last word of the common name (usually the kind of plant), cut to six letters. */
export function shortName(name: string): string {
  const words = name.trim().split(/[\s-]+/);
  const last = words[words.length - 1] ?? name;
  const word = last.charAt(0).toUpperCase() + last.slice(1);
  return word.length > 6 ? `${word.slice(0, 5)}.` : word;
}

/**
 * What Sage says. Points at the first thing to fix, in the order the program
 * would trip over it, and only cheers when every plan rule passes.
 */
export function sageLine(check: RebateCheck, minSqft: number, minCoverPct: number): string {
  const result = (code: string) => check.outcomes.find((o) => o.code === code)?.result;
  const converted = check.eligibleSqft;

  if (converted === 0) return "Pick a plant or mulch below, then tap squares to swap out the grass.";
  if (converted < minSqft) {
    return `${converted} sq ft so far. The program wants at least ${minSqft}, so keep going, or add another area later.`;
  }
  if (check.coveragePct < minCoverPct) {
    return `Plants will cover about ${Math.round(check.coveragePct)}% when grown. Aim for ${minCoverPct}%: swap some mulch for plants, or pick ones that spread wider.`;
  }
  if (result("C1") === "fail") return "That leftover lawn is too skinny. Keep lawn at least 8 ft wide, or plant it up too.";
  if (result("C12") === "fail") return "That's a lot of pavers for this yard. Trade a few for gravel mulch, which counts.";
  if (result("C10") === "fail") return "Some of these grow over 24 inches. Park strips need low plants only.";
  if (result("C2") === "warn") return "Looking close! A few plants are missing details, so double-check the cover before you apply.";
  return `Nice work. This plan meets the rules we can check, for about ${"$" + Math.round(check.estimatedAmount).toLocaleString("en-US")}.`;
}
