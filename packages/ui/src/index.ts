/**
 * Product vocabulary that sits on top of the Nativo design system. The tokens
 * themselves live in design/nativo/tokens.css; the names below point at them.
 *
 * Use these for the places CSS custom properties cannot reach, such as canvas
 * rendering, SVG generated in JS and chart libraries.
 */

/** Depth bands as SSURGO reports them. */
export const SOIL_HORIZONS = [
  { topCm: 0, bottomCm: 5 },
  { topCm: 5, bottomCm: 15 },
  { topCm: 15, bottomCm: 30 },
  { topCm: 30, bottomCm: 60 },
  { topCm: 60, bottomCm: 100 },
  { topCm: 100, bottomCm: 200 },
] as const;

export type Confidence = "high" | "medium" | "low";

/** Each level pairs a Nativo fill with its matching text token. */
export const CONFIDENCE_TOKENS: Record<Confidence, { fg: string; bg: string; label: string }> = {
  high: { fg: "--on-green", bg: "--green", label: "Measured" },
  medium: { fg: "--on-gold", bg: "--gold", label: "Survey estimate" },
  low: { fg: "--on-clay", bg: "--clay", label: "Modelled" },
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
