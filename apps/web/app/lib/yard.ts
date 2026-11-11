/**
 * The yard estimate on the pages: turning it into a starting plot for the
 * planner, and carrying the gardener's choice between pages in the link.
 * No React here, so the rules can be tested on their own.
 */
import { MAX_SQUARES, SQUARE_FT, SQUARE_SQFT, type AreaKind, type YardEstimate, type YardZone, type YardZoneKind } from "@np/shared";
import { MAX_SIDE_FT, MIN_SIDE_FT } from "./planner";

export const ZONE_LABELS: Record<YardZoneKind, string> = {
  front: "Front yard",
  back: "Backyard",
  side: "Side yard",
};

/**
 * The rebate's rules know front yards and backyards. A side yard is planned
 * as backyard: the looser hardscape limit applies to anything not in front.
 */
export const ZONE_TO_AREA: Record<YardZoneKind, AreaKind> = { front: "front", back: "back", side: "back" };

/** The planner holds one area of up to this much at a time. */
export const MAX_PLAN_SQFT = MAX_SQUARES * SQUARE_SQFT;

/** Our first guess at the lawn in a zone: its planted ground, to the nearest 10 sq ft. */
export function defaultLawn(zone: YardZone): number {
  const planted = zone.plantedSqft ?? zone.areaSqft;
  return Math.round(planted / 10) * 10;
}

const step = (ft: number) => Math.round(ft / SQUARE_FT) * SQUARE_FT;
const clampSide = (ft: number) => Math.min(MAX_SIDE_FT, Math.max(MIN_SIDE_FT, step(ft)));

/**
 * A starting plot for the planner: close to the lawn the gardener wants to
 * replace, shaped like the zone (its depth from the street kept where it
 * fits), in 5 ft squares and inside the planner's limits.
 */
export function plannerStart(lawnSqft: number, zone: Pick<YardZone, "widthFt" | "depthFt">): { widthFt: number; depthFt: number } {
  const target = Math.min(Math.max(lawnSqft, SQUARE_SQFT), MAX_PLAN_SQFT);
  // Depth rounds down: the plot should never be deeper than the yard really is.
  const depthFt = Math.min(
    MAX_SIDE_FT,
    Math.max(MIN_SIDE_FT, Math.floor(Math.min(zone.depthFt, Math.sqrt(target) * 2, target / MIN_SIDE_FT) / SQUARE_FT) * SQUARE_FT),
  );
  let widthFt = clampSide(target / depthFt);
  while ((widthFt / SQUARE_FT) * (depthFt / SQUARE_FT) > MAX_SQUARES && widthFt > MIN_SIDE_FT) widthFt -= SQUARE_FT;
  return { widthFt, depthFt };
}

/** What the gardener chose on the report, carried to the planner in the link. */
export interface YardChoice {
  zone: YardZoneKind;
  /** All open ground in that zone, from the estimate. */
  zoneSqft: number;
  /** How much of it they say is lawn they would replace. */
  lawnSqft: number;
  widthFt: number;
  depthFt: number;
}

export function choiceToParams(c: YardChoice): Record<string, string> {
  return { yz: c.zone, ya: String(c.zoneSqft), yl: String(c.lawnSqft), yw: String(c.widthFt), yd: String(c.depthFt) };
}

export function choiceFromParams(params: URLSearchParams): YardChoice | null {
  const zone = params.get("yz");
  if (zone !== "front" && zone !== "back" && zone !== "side") return null;
  const n = (k: string) => Number(params.get(k));
  const [zoneSqft, lawnSqft, widthFt, depthFt] = [n("ya"), n("yl"), n("yw"), n("yd")];
  if (![zoneSqft, lawnSqft, widthFt, depthFt].every((v) => Number.isFinite(v) && v > 0)) return null;
  // Only plots the planner can hold, so a hand-edited link cannot break it.
  if (widthFt % SQUARE_FT || depthFt % SQUARE_FT || widthFt > MAX_SIDE_FT || depthFt > MAX_SIDE_FT) return null;
  if ((widthFt / SQUARE_FT) * (depthFt / SQUARE_FT) > MAX_SQUARES) return null;
  return { zone, zoneSqft, lawnSqft, widthFt, depthFt };
}

/** The zone the gardener most likely wants first: the front yard if it has lawn, else the one with the most. */
export function suggestedZone(estimate: YardEstimate): YardZone | null {
  const withGround = estimate.zones.filter((z) => z.areaSqft >= 100);
  const front = withGround.find((z) => z.kind === "front" && (z.plantedSqft ?? z.areaSqft) >= 200);
  if (front) return front;
  return [...withGround].sort((a, b) => (b.plantedSqft ?? b.areaSqft) - (a.plantedSqft ?? a.areaSqft))[0] ?? null;
}

/** Runs of the same code on each row, so the page draws a few hundred shapes, not thousands of pixels. */
export function cellRuns(cells: YardEstimate["drawing"]["cells"], wanted: string): { row: number; col: number; length: number }[] {
  const out: { row: number; col: number; length: number }[] = [];
  for (let r = 0; r < cells.rows; r++) {
    let start = -1;
    for (let c = 0; c <= cells.columns; c++) {
      const hit = c < cells.columns && cells.codes[r * cells.columns + c] === wanted;
      if (hit && start < 0) start = c;
      if (!hit && start >= 0) {
        out.push({ row: r, col: start, length: c - start });
        start = -1;
      }
    }
  }
  return out;
}
