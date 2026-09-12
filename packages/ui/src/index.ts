/**
 * Design tokens as typed constants, for the places CSS custom properties
 * cannot reach — canvas rendering, SVG generated in JS, chart libraries.
 *
 * These MUST stay in sync with tokens.css. When they drift, the soil horizon
 * drawn on a canvas stops matching the one drawn in CSS, which is exactly the
 * kind of bug nobody files and everybody notices.
 */

/** Depth bands as SSURGO reports them, with their ramp colour. */
export const SOIL_HORIZONS = [
  { topCm: 0, bottomCm: 5, token: "--np-horizon-0" },
  { topCm: 5, bottomCm: 15, token: "--np-horizon-1" },
  { topCm: 15, bottomCm: 30, token: "--np-horizon-2" },
  { topCm: 30, bottomCm: 60, token: "--np-horizon-3" },
  { topCm: 60, bottomCm: 100, token: "--np-horizon-4" },
  { topCm: 100, bottomCm: 200, token: "--np-horizon-5" },
] as const;

export type Confidence = "high" | "medium" | "low";

export const CONFIDENCE_TOKENS: Record<Confidence, { fg: string; bg: string; label: string }> = {
  high: { fg: "--np-conf-high", bg: "--np-conf-high-bg", label: "Measured" },
  medium: { fg: "--np-conf-med", bg: "--np-conf-med-bg", label: "Survey estimate" },
  low: { fg: "--np-conf-low", bg: "--np-conf-low-bg", label: "Modelled" },
};

/**
 * How each data source is described to a gardener. Never show the raw source
 * key — "ssurgo" means nothing to someone standing in their yard.
 */
export const SOURCE_LABELS: Record<string, string> = {
  ssurgo: "County soil survey",
  statsgo: "Regional soil map",
  noaa_normals: "NOAA 30-year normals",
  usda_phzm: "USDA hardiness map",
  solar_geometry: "Calculated from your latitude",
  user_reported: "You told us",
  soil_test: "Your soil test",
};
