/**
 * The plant review page's rules, kept free of React so they can be tested:
 * the queue, the facts in plain words, and the checks against the game.
 */
import { ordinalToZone, type ReviewPhoto, type ReviewPlant } from "@np/shared";
import type { GardenSprite } from "../content/garden-sprites";

export type ReviewFilter = "todo" | "failed" | "passed" | "all";

/** Where a plant stands, in the reviewer's terms. */
export type ReviewState = "todo" | "changed" | "failed" | "passed";

export function reviewState(p: ReviewPlant): ReviewState {
  if (!p.lastReview) return "todo";
  if (p.lastReview.factsChangedSince) return "changed";
  return p.lastReview.decision === "pass" ? "passed" : "failed";
}

export const STATE_LABELS: Record<ReviewState, string> = {
  todo: "To review",
  changed: "Changed since review",
  failed: "Failed",
  passed: "Passed",
};

export function matchesFilter(p: ReviewPlant, filter: ReviewFilter): boolean {
  const s = reviewState(p);
  if (filter === "all") return true;
  if (filter === "todo") return s === "todo" || s === "changed";
  if (filter === "failed") return s === "failed";
  return s === "passed";
}

export function counts(plants: ReviewPlant[]) {
  const c = { todo: 0, failed: 0, passed: 0, all: plants.length };
  for (const p of plants) {
    const s = reviewState(p);
    if (s === "todo" || s === "changed") c.todo++;
    else if (s === "failed") c.failed++;
    else c.passed++;
  }
  return c;
}

/**
 * The next plant to show after a decision: the next one in the list that
 * still matches the filter, wrapping round, and never the one just decided.
 */
export function nextPlantId(
  plants: ReviewPlant[],
  filter: ReviewFilter,
  afterId: string | null,
  decided: ReadonlySet<string> = new Set(),
): string | null {
  const pool = plants.filter((p) => matchesFilter(p, filter) && !decided.has(p.id));
  if (pool.length === 0) return null;
  if (afterId === null) return pool[0]!.id;
  const start = plants.findIndex((p) => p.id === afterId);
  for (let i = 1; i <= plants.length; i++) {
    const p = plants[(start + i) % plants.length]!;
    if (pool.includes(p) && p.id !== afterId) return p.id;
  }
  return null;
}

/* ---- Facts in plain words ---------------------------------------------------- */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const monthName = (m: number | null) => (m && m >= 1 && m <= 12 ? MONTHS[m - 1]! : null);

export function bloomText(p: Pick<ReviewPlant, "bloomStartMonth" | "bloomEndMonth">): string {
  const a = monthName(p.bloomStartMonth);
  const b = monthName(p.bloomEndMonth);
  if (!a || !b) return "Not recorded";
  return a === b ? a : `${a} to ${b}`;
}

/** 60 cm → "2 ft (60 cm)"; 30 cm → "12 in (30 cm)". */
export function sizeText(cm: number): string {
  const inches = Math.round(cm / 2.54);
  const imperial = inches >= 24 ? `${Math.round((inches / 12) * 10) / 10} ft` : `${inches} in`;
  return `${imperial} (${Math.round(cm)} cm)`;
}

export const WATER_LABELS: Record<string, string> = {
  very_low: "Very low water",
  low: "Low water",
  moderate: "Moderate water",
  high: "High water",
};

export const NATIVE_LABELS: Record<string, string> = {
  native: "Native to the Wasatch Front",
  regionally_native: "Native to the region",
  adapted: "Adapted, not native",
  introduced: "Introduced",
};

export const DRAINAGE_SHORT: Record<string, string> = {
  excessively_drained: "very fast",
  somewhat_excessively_drained: "fast",
  well_drained: "well drained",
  moderately_well_drained: "fairly well drained",
  somewhat_poorly_drained: "slow",
  poorly_drained: "poorly drained",
  very_poorly_drained: "wet",
};

const yesNo = (b: boolean | null) => (b === null ? "Not recorded" : b ? "Yes" : "No");

/** The facts a gardener is told, grouped, each as label and plain value. */
export function factGroups(p: ReviewPlant): { title: string; facts: { label: string; value: string; warn?: boolean }[] }[] {
  return [
    {
      title: "What it is",
      facts: [
        { label: "Family", value: p.family },
        { label: "Form", value: p.plantForm ? cap(p.plantForm) : "Not recorded", warn: !p.plantForm },
        { label: "Life cycle", value: p.lifeCycle ? cap(p.lifeCycle) : "Not recorded", warn: !p.lifeCycle },
        { label: "Native status", value: NATIVE_LABELS[p.nativeStatus] ?? p.nativeStatus },
      ],
    },
    {
      title: "Size and bloom",
      facts: [
        { label: "Grown height", value: sizeText(p.matureHeightCm) },
        { label: "Grown width", value: sizeText(p.matureWidthCm) },
        { label: "Blooms", value: bloomText(p) },
        {
          label: "Stays under 24 in without pruning",
          value: yesNo(p.staysUnder24In),
          warn: p.staysUnder24In === null || (p.staysUnder24In === true && p.matureHeightCm > 61),
        },
      ],
    },
    {
      title: "Ground and climate",
      facts: [
        { label: "Soil pH", value: `${p.phMin.toFixed(1)} to ${p.phMax.toFixed(1)}, best ${p.phOptimum.toFixed(1)}` },
        { label: "Drainage", value: p.drainageTolerated.map((d) => DRAINAGE_SHORT[d] ?? d).join(", ") },
        { label: "Direct sun", value: p.sunMaxHours >= 24 ? `${p.sunMinHours}+ hours a day` : `${p.sunMinHours} to ${p.sunMaxHours} hours a day` },
        { label: "Water", value: WATER_LABELS[p.waterUse] ?? p.waterUse },
        { label: "Hardiness zones", value: `${ordinalToZone(p.zoneMinOrdinal)} to ${ordinalToZone(p.zoneMaxOrdinal)}` },
      ],
    },
    {
      title: "Wildlife and safety",
      facts: [
        { label: "Pollinator value", value: cap(p.pollinatorValue) },
        { label: "Deer resistant", value: yesNo(p.deerResistant) },
        { label: "Edible", value: yesNo(p.edible) },
        { label: "Good for cutting", value: yesNo(p.goodForCutting) },
        { label: "Toxicity", value: p.toxicityNote ?? "No warning recorded", warn: p.toxicityNote !== null },
      ],
    },
  ];
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1).replace(/_/g, " ") : s);

/* ---- The garden game's words against the sheet ------------------------------ */

const MONTH_INDEX = new Map(MONTHS.map((m, i) => [m.toLowerCase(), i + 1]));

/**
 * Reads the game's line ("Low water. Blooms April to June.") and compares it
 * with the sheet. Returns each disagreement in plain words; empty means they
 * agree on everything the line says.
 */
export function gameTextMismatches(text: string | null, p: Pick<ReviewPlant, "waterUse" | "bloomStartMonth" | "bloomEndMonth">): string[] {
  if (!text) return [];
  const out: string[] = [];
  const water = /^(very low|low|moderate|high) water/i.exec(text)?.[1]?.toLowerCase().replace(" ", "_");
  if (water && water !== p.waterUse) {
    out.push(`The game says ${WATER_LABELS[water]?.toLowerCase()}; the sheet says ${WATER_LABELS[p.waterUse]?.toLowerCase() ?? p.waterUse}.`);
  }
  const bloom = /(?:blooms|seed heads) (\w+) to (\w+)/i.exec(text);
  if (bloom) {
    const a = MONTH_INDEX.get(bloom[1]!.toLowerCase());
    const b = MONTH_INDEX.get(bloom[2]!.toLowerCase());
    if (a !== p.bloomStartMonth || b !== p.bloomEndMonth) {
      out.push(`The game says ${bloom[1]} to ${bloom[2]}; the sheet says ${bloomText(p)}.`);
    }
  }
  return out;
}

export function spriteSummary(sprite: GardenSprite | null) {
  return sprite ? `${sprite.gameName} (${sprite.scientificName})` : null;
}

/* ---- Photo choices -------------------------------------------------------------------- */

export type PhotoChoice = Pick<ReviewPhoto, "id" | "status" | "kind" | "note">;

/**
 * Set one photo's use. Only one photo can be the main (habit) photo and one
 * the close-up (detail): choosing a new one moves the old one back to
 * "approved, no use" rather than losing it.
 */
export function choosePhoto(choices: PhotoChoice[], id: string, choice: "habit" | "detail" | "rejected" | "candidate"): PhotoChoice[] {
  return choices.map((c) => {
    if (c.id === id) {
      if (choice === "rejected" || choice === "candidate") return { ...c, status: choice, kind: null };
      return { ...c, status: "approved", kind: choice };
    }
    if ((choice === "habit" || choice === "detail") && c.kind === choice) return { ...c, kind: null };
    return c;
  });
}

/** What still needs doing on the photos before a pass, in plain words. */
export function photoGaps(choices: PhotoChoice[], available: number): string[] {
  if (available === 0) return ["No photos found yet. You can still pass the plant's facts."];
  const gaps: string[] = [];
  if (!choices.some((c) => c.kind === "habit")) gaps.push("No main photo chosen.");
  if (!choices.some((c) => c.kind === "detail")) gaps.push("No close-up chosen.");
  return gaps;
}
