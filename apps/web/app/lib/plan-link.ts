/**
 * A plan, packed into a link. The plan document page and the plan email both
 * use it, so a plan can be opened, printed and sent without us storing it.
 *
 * The squares go as one letter each: "l" lawn, "m" mulch, "h" pavers, or the
 * plant's position in the list ("A" to "Z", then "a" to "k"). With the plant
 * ids, the size and the place, a 160-square plan fits in well under 2,000
 * characters.
 */
import { MAX_SQUARES, SQUARE_FT, planLayoutSchema, type Cell, type PlanLayout } from "@np/shared";
import { placeFromParams, placeToParams, type Place } from "./flow";

const PLANT_CODES = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk";
const FIXED: Record<string, Cell> = { l: { kind: "lawn" }, m: { kind: "mulch" }, h: { kind: "pavers" } };

export interface PlanLink {
  plan: PlanLayout;
  place: Place | null;
}

const toBase64Url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

/** The plan as a short code for the `p` parameter. */
export function encodePlan(plan: PlanLayout): string {
  const ids: string[] = [];
  const squares = plan.cells
    .map((c) => {
      if (c.kind !== "plant") return c.kind === "lawn" ? "l" : c.kind === "mulch" ? "m" : "h";
      let i = ids.indexOf(c.plantId);
      if (i < 0) i = ids.push(c.plantId) - 1;
      return PLANT_CODES[i] ?? "l";
    })
    .join("");
  return toBase64Url(JSON.stringify({ v: 1, a: plan.areaKind, w: plan.widthFt, d: plan.depthFt, s: squares, p: ids }));
}

/** Reads a plan code back, or null if it is damaged or describes something the planner could not hold. */
export function decodePlan(code: string | null): PlanLayout | null {
  if (!code || code.length > 6000) return null;
  try {
    const raw = JSON.parse(fromBase64Url(code)) as { v?: number; a?: string; w?: number; d?: number; s?: string; p?: string[] };
    if (raw.v !== 1 || typeof raw.s !== "string" || !Array.isArray(raw.p)) return null;
    const ids = raw.p;
    const cells = [...raw.s].map((ch): Cell | null => {
      if (FIXED[ch]) return FIXED[ch]!;
      const id = ids[PLANT_CODES.indexOf(ch)];
      return typeof id === "string" ? { kind: "plant", plantId: id } : null;
    });
    if (cells.some((c) => c === null)) return null;
    const plan = planLayoutSchema.safeParse({ areaKind: raw.a, widthFt: raw.w, depthFt: raw.d, cells });
    if (!plan.success) return null;
    const p = plan.data;
    if (p.cells.length !== (p.widthFt / SQUARE_FT) * (p.depthFt / SQUARE_FT) || p.cells.length > MAX_SQUARES) return null;
    return p;
  } catch {
    return null;
  }
}

/** The path and query for a plan's document page. */
export function planDocumentHref(plan: PlanLayout, place: Place | null): string {
  const params = new URLSearchParams(place ? placeToParams(place) : "");
  params.set("p", encodePlan(plan));
  return `/plan/document?${params.toString()}`;
}

export function planFromParams(params: URLSearchParams): PlanLink | null {
  const plan = decodePlan(params.get("p"));
  return plan ? { plan, place: placeFromParams(params) } : null;
}
