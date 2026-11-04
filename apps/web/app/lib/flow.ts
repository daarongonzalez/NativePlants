/**
 * Shapes and helpers for the address → report → plan flow. Kept free of React
 * so they can be tested on their own.
 */
import type { PlanPlant, RebateProgramSummary } from "@np/shared";

/** The rebate program the flow plans for. Utah only, for now. */
export const PROGRAM_CODE = "ut-landscape-incentive";

export type MatchQuality = "rooftop" | "interpolated" | "approximate";

export interface AddressMatch {
  latitude: number;
  longitude: number;
  matchedAddress: string;
  zip: string;
  matchQuality: MatchQuality;
}

export interface Provenance {
  source: string;
  confidence: "high" | "medium" | "low" | string;
  retrievedAt: string;
  note?: string;
}

export interface ProfileResponse {
  zone: string;
  values: {
    zoneOrdinal: number;
    ph: number | null;
    sandPct: number | null;
    siltPct: number | null;
    clayPct: number | null;
    drainageClass: string | null;
    sunHoursSummer: number;
  };
  provenance: Record<string, Provenance>;
  caveats: string[];
  detail: {
    frostStation: {
      name: string;
      distanceKm: number;
      normalsPeriod: string;
      lastSpringP10: string;
      lastSpringP50: string;
      lastSpringP90: string;
      firstFallP10: string;
      firstFallP50: string;
      firstFallP90: string;
      frostFreeDays: number;
    } | null;
    soil: {
      name: string;
      surveyArea: string;
      measured: boolean;
      horizons: { depthTopCm: number; depthBottomCm: number; ph: number | null; sandPct: number | null; siltPct: number | null; clayPct: number | null }[];
    } | null;
  };
}

export interface ProgramResponse {
  program: RebateProgramSummary;
  areas: { communityName: string; waterSupplier: string | null; hasSecondaryWater: boolean | null }[];
  plants: PlanPlant[];
}

/** The place, carried between pages in the query string. No account, nothing stored. */
export interface Place {
  address: string;
  latitude: number;
  longitude: number;
  zip: string;
  matchQuality: MatchQuality;
}

export function placeToParams(place: Place, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    address: place.address,
    lat: place.latitude.toFixed(6),
    lon: place.longitude.toFixed(6),
    zip: place.zip,
    q: place.matchQuality,
    ...extra,
  });
  return params.toString();
}

export function placeFromParams(params: URLSearchParams): Place | null {
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  const zip = params.get("zip") ?? "";
  const q = params.get("q");
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude === 0 || !/^\d{5}$/.test(zip)) return null;
  const matchQuality: MatchQuality = q === "rooftop" || q === "interpolated" ? q : "approximate";
  return { address: params.get("address") ?? "", latitude, longitude, zip, matchQuality };
}

/** Plain names for where a value came from. */
export const SOURCE_LABELS: Record<string, string> = {
  usda_phzm: "USDA Plant Hardiness Zone Map",
  noaa_normals: "NOAA climate normals",
  ssurgo: "USDA county soil survey",
  solar_geometry: "Calculated from your latitude",
  user_reported: "You told us",
  census_geocoder: "US Census Bureau geocoder",
};

export const sourceLabel = (source: string) => SOURCE_LABELS[source] ?? source;

/** Confidence, always in words as well as colour. */
export const CONFIDENCE_LABELS: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

export const MATCH_LABELS: Record<MatchQuality, string> = {
  rooftop: "Matched to the building",
  interpolated: "Placed along the street",
  approximate: "Approximate location",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "05-03" → "3 May". */
export function formatMonthDay(md: string): string {
  const [m, d] = md.split("-").map(Number);
  if (!m || !d || m < 1 || m > 12) return md;
  return `${d} ${MONTHS[m - 1]}`;
}

/** Day of year for a "MM-DD", in a non-leap year. Used to place dates on a track. */
export function dayOfYear(md: string): number {
  const [m, d] = md.split("-").map(Number);
  const starts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return (starts[(m ?? 1) - 1] ?? 0) + (d ?? 1);
}

/** Percent position of a date on a track from `from` to `to` (both "MM-DD"). */
export function trackPosition(md: string, from: string, to: string): number {
  const start = dayOfYear(from);
  const end = dayOfYear(to);
  const pct = ((dayOfYear(md) - start) / (end - start)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}

export const DRAINAGE_LABELS: Record<string, string> = {
  excessively_drained: "Drains very fast",
  somewhat_excessively_drained: "Drains fast",
  well_drained: "Drains well",
  moderately_well_drained: "Drains fairly well",
  somewhat_poorly_drained: "Drains slowly",
  poorly_drained: "Drains poorly",
  very_poorly_drained: "Stays wet",
};

export const TEXTURE_LABELS: Record<string, string> = {
  sand: "Sand",
  loamy_sand: "Loamy sand",
  sandy_loam: "Sandy loam",
  loam: "Loam",
  silt_loam: "Silt loam",
  silt: "Silt",
  sandy_clay_loam: "Sandy clay loam",
  clay_loam: "Clay loam",
  silty_clay_loam: "Silty clay loam",
  sandy_clay: "Sandy clay",
  silty_clay: "Silty clay",
  clay: "Clay",
};

/** What a pH means for planting, in a few words. */
export function phMeaning(ph: number): string {
  if (ph >= 8.5) return "Strongly alkaline";
  if (ph >= 7.8) return "Alkaline";
  if (ph > 7.2) return "Slightly alkaline";
  if (ph >= 6.6) return "Neutral";
  if (ph >= 6) return "Slightly acid";
  return "Acid";
}

export const inches = (cm: number) => Math.round(cm / 2.54);

export function formatDollars(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** "2026-11-01T00:00:00.000Z" → "1 Nov 2026". */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
