/**
 * Reduce a map unit's horizons to the single topsoil answer a garden cares
 * about. Pure, no I/O.
 *
 * Roots of most garden plants live in the top 30 cm, so that is the layer we
 * report. Each property is averaged over the part of each horizon that falls
 * inside it, weighted by thickness. A property is averaged only across the
 * horizons that actually have a value, so one unmeasured layer does not drag
 * the result toward zero.
 */

export const TOPSOIL_DEPTH_CM = 30;

export interface HorizonInput {
  depthTopCm: number;
  depthBottomCm: number;
  ph: number | null;
  sandPct: number | null;
  siltPct: number | null;
  clayPct: number | null;
}

export interface TopsoilSummary {
  ph: number | null;
  sandPct: number | null;
  siltPct: number | null;
  clayPct: number | null;
}

type Property = keyof TopsoilSummary;

function weightedMean(horizons: readonly HorizonInput[], property: Property): number | null {
  let total = 0;
  let weight = 0;
  for (const h of horizons) {
    const value = h[property];
    if (value === null) continue;
    const overlap = Math.min(h.depthBottomCm, TOPSOIL_DEPTH_CM) - Math.max(h.depthTopCm, 0);
    if (overlap <= 0) continue;
    total += value * overlap;
    weight += overlap;
  }
  return weight === 0 ? null : Math.round((total / weight) * 10) / 10;
}

export function summarizeTopsoil(horizons: readonly HorizonInput[]): TopsoilSummary {
  return {
    ph: weightedMean(horizons, "ph"),
    sandPct: weightedMean(horizons, "sandPct"),
    siltPct: weightedMean(horizons, "siltPct"),
    clayPct: weightedMean(horizons, "clayPct"),
  };
}
