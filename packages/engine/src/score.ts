import type { Goals, Plant, SiteProfile } from "@np/shared";

/**
 * The recommendation engine.
 *
 * This module has no I/O. No database, no network, no framework. It takes a
 * resolved site profile and a list of plants and returns a ranking. That
 * constraint is deliberate: it means a horticulturist can review the engine's
 * behaviour against a fixture file without running the application, and it
 * means every recommendation is reproducible from its inputs.
 *
 * It is a scoring function, not a model. Gardeners ask "why this plant?" and
 * being able to answer plainly is a feature, not a nicety. If we cannot
 * explain a recommendation, we do not show it.
 */

/** Why a plant was excluded outright. */
export type Exclusion =
  | { kind: "zone_too_cold"; siteZone: number; plantMin: number }
  | { kind: "zone_too_warm"; siteZone: number; plantMax: number }
  | { kind: "ph_too_low"; sitePh: number; plantMin: number }
  | { kind: "ph_too_high"; sitePh: number; plantMax: number }
  | { kind: "drainage_intolerant"; siteDrainage: string };

/** One scored dimension, with the language the interface shows. */
export interface Component {
  name: "ph" | "drainage" | "sun" | "water" | "goals";
  /** 0 to 1. Higher is a better fit. */
  score: number;
  /** Relative importance in the final score. */
  weight: number;
  /** Plain language, written for a gardener, not a developer. */
  explanation: string;
}

export interface Recommendation {
  plant: Plant;
  /** 0 to 1, weighted mean of the components. */
  score: number;
  components: Component[];
  /** The single most useful sentence about this match. */
  headline: string;
}

export interface Rejection {
  plant: Plant;
  exclusion: Exclusion;
}

export interface ScoringResult {
  recommended: Recommendation[];
  rejected: Rejection[];
}

/**
 * How far outside a plant's stated pH range we still consider it viable.
 * Published tolerance ranges are conservative and soil survey values are an
 * area average, so a hard cutoff at the stated edge rejects plants that do
 * fine in practice. Widening past ~0.3 starts producing bad advice.
 */
const PH_TOLERANCE = 0.3;

const BASE_WEIGHTS = { ph: 0.3, drainage: 0.25, sun: 0.25, water: 0.1, goals: 0.1 } as const;

/** Linear falloff from 1 at `optimum` to 0 at `worst`. */
function falloff(value: number, optimum: number, worst: number): number {
  const span = Math.abs(worst - optimum);
  if (span === 0) return value === optimum ? 1 : 0;
  return clamp01(1 - Math.abs(value - optimum) / span);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function excludeFor(profile: SiteProfile, plant: Plant): Exclusion | null {
  const zone = profile.zoneOrdinal.value;
  if (zone < plant.zoneMinOrdinal) {
    return { kind: "zone_too_cold", siteZone: zone, plantMin: plant.zoneMinOrdinal };
  }
  if (zone > plant.zoneMaxOrdinal) {
    return { kind: "zone_too_warm", siteZone: zone, plantMax: plant.zoneMaxOrdinal };
  }

  const ph = profile.ph.value;
  if (ph < plant.phMin - PH_TOLERANCE) {
    return { kind: "ph_too_low", sitePh: ph, plantMin: plant.phMin };
  }
  if (ph > plant.phMax + PH_TOLERANCE) {
    return { kind: "ph_too_high", sitePh: ph, plantMax: plant.phMax };
  }

  if (!plant.drainageTolerated.includes(profile.drainageClass.value)) {
    return { kind: "drainage_intolerant", siteDrainage: profile.drainageClass.value };
  }

  return null;
}

function scorePh(profile: SiteProfile, plant: Plant): Component {
  const ph = profile.ph.value;
  const worst = ph < plant.phOptimum ? plant.phMin - PH_TOLERANCE : plant.phMax + PH_TOLERANCE;
  const score = falloff(ph, plant.phOptimum, worst);

  const explanation =
    score > 0.85
      ? `Your soil pH of ${ph.toFixed(1)} is close to ideal for this plant.`
      : score > 0.5
        ? `Tolerates your soil pH of ${ph.toFixed(1)}, though it prefers ${plant.phOptimum.toFixed(1)}.`
        : `Your soil pH of ${ph.toFixed(1)} is near the edge of what this plant handles.`;

  return { name: "ph", score, weight: BASE_WEIGHTS.ph, explanation };
}

function scoreDrainage(profile: SiteProfile, plant: Plant): Component {
  // Reaching here means the class is tolerated; reward a shorter tolerance
  // list, since a plant that accepts everything tells us little.
  const breadth = plant.drainageTolerated.length;
  const score = breadth <= 2 ? 1 : clamp01(1 - (breadth - 2) * 0.12);
  const readable = profile.drainageClass.value.replaceAll("_", " ");

  return {
    name: "drainage",
    score,
    weight: BASE_WEIGHTS.drainage,
    explanation: `Handles your ${readable} soil.`,
  };
}

function scoreSun(profile: SiteProfile, plant: Plant): Component {
  const hours = profile.sunHoursSummer.value;
  const { minHours, maxHours } = plant.sun;
  const midpoint = (minHours + maxHours) / 2;

  let score: number;
  let explanation: string;

  if (hours >= minHours && hours <= maxHours) {
    score = 1 - Math.abs(hours - midpoint) / Math.max(maxHours - minHours, 1) * 0.2;
    explanation = `Your ${hours.toFixed(1)} hours of summer sun suits it well.`;
  } else if (hours < minHours) {
    score = clamp01(1 - (minHours - hours) / 4);
    explanation = `Wants more sun than this spot's ${hours.toFixed(1)} hours — expect fewer blooms.`;
  } else {
    score = clamp01(1 - (hours - maxHours) / 4);
    explanation = `More sun than it prefers at ${hours.toFixed(1)} hours — may need afternoon shade.`;
  }

  return { name: "sun", score: clamp01(score), weight: BASE_WEIGHTS.sun, explanation };
}

function scoreWater(profile: SiteProfile, plant: Plant, goals: Goals): Component {
  const rank = { very_low: 0, low: 1, moderate: 2, high: 3 } as const;
  const plantRank = rank[plant.waterUse];

  // Without irrigation, thirsty plants are a bad bet regardless of goals.
  const irrigated = profile.constraints.irrigationAvailable;
  let score = irrigated ? 1 - plantRank * 0.15 : clamp01(1 - plantRank * 0.4);

  if (goals.lowWater) score = clamp01(score - plantRank * 0.15);

  const readable = plant.waterUse.replaceAll("_", " ");
  const explanation = irrigated
    ? `${readable} water use once established.`
    : `${readable} water use — worth knowing with no irrigation on this site.`;

  return { name: "water", score: clamp01(score), weight: BASE_WEIGHTS.water, explanation };
}

function scoreGoals(plant: Plant, goals: Goals): Component {
  const asked: boolean[] = [];
  const met: string[] = [];

  if (goals.pollinators) {
    const hit = plant.pollinatorValue === "high" || plant.pollinatorValue === "moderate";
    asked.push(hit);
    if (hit) met.push("supports pollinators");
  }
  if (goals.deerResistant) {
    asked.push(plant.deerResistant);
    if (plant.deerResistant) met.push("deer tend to leave it alone");
  }
  if (goals.cutFlowers) {
    asked.push(plant.goodForCutting);
    if (plant.goodForCutting) met.push("good for cutting");
  }
  if (goals.edible) {
    asked.push(plant.edible);
    if (plant.edible) met.push("edible");
  }
  if (goals.lowWater) {
    const hit = plant.waterUse === "very_low" || plant.waterUse === "low";
    asked.push(hit);
    if (hit) met.push("low water");
  }

  // No goals selected is neutral, not a penalty.
  const score = asked.length === 0 ? 1 : asked.filter(Boolean).length / asked.length;

  return {
    name: "goals",
    score,
    weight: BASE_WEIGHTS.goals,
    explanation: met.length > 0 ? `Matches what you asked for: ${met.join(", ")}.` : "",
  };
}

/** The component that most distinguishes this match, for the card headline. */
function headlineFor(components: Component[]): string {
  const spoken = components.filter((c) => c.explanation !== "");
  if (spoken.length === 0) return "A reasonable fit for this site.";

  const weakest = spoken.reduce((a, b) => (a.score <= b.score ? a : b));
  if (weakest.score < 0.6) return weakest.explanation;

  const strongest = spoken.reduce((a, b) => (a.score >= b.score ? a : b));
  return strongest.explanation;
}

/**
 * Score one plant against one site. Returns null when the plant is excluded.
 */
export function scorePlant(
  profile: SiteProfile,
  plant: Plant,
  goals: Goals,
): Recommendation | Rejection {
  const exclusion = excludeFor(profile, plant);
  if (exclusion) return { plant, exclusion };

  const components: Component[] = [
    scorePh(profile, plant),
    scoreDrainage(profile, plant),
    scoreSun(profile, plant),
    scoreWater(profile, plant, goals),
    scoreGoals(plant, goals),
  ];

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weighted = components.reduce((sum, c) => sum + c.score * c.weight, 0);

  return {
    plant,
    score: round2(weighted / totalWeight),
    components,
    headline: headlineFor(components),
  };
}

function isRejection(r: Recommendation | Rejection): r is Rejection {
  return "exclusion" in r;
}

/**
 * Rank a catalogue against a site.
 *
 * Rejections are returned rather than discarded — "we considered 140 plants and
 * ruled out 96 because your soil is alkaline" is more trustworthy than a bare
 * list, and it is how a gardener learns what their ground is like.
 */
export function recommend(
  profile: SiteProfile,
  plants: readonly Plant[],
  goals: Goals,
): ScoringResult {
  const recommended: Recommendation[] = [];
  const rejected: Rejection[] = [];

  for (const plant of plants) {
    const result = scorePlant(profile, plant, goals);
    if (isRejection(result)) rejected.push(result);
    else recommended.push(result);
  }

  recommended.sort(
    (a, b) => b.score - a.score || a.plant.scientificName.localeCompare(b.plant.scientificName),
  );

  return { recommended, rejected };
}
