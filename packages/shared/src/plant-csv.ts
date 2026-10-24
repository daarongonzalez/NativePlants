import { drainageClassSchema } from "./site";
import { nativeStatusSchema, waterUseSchema, type NativeStatus, type WaterUse } from "./plant";
import { zoneToOrdinal } from "./units";

/**
 * The curation spreadsheet, as a CSV.
 *
 * One row per species. The horticultural reviewer edits a sheet; the sheet is
 * exported to CSV and committed, so every change to plant advice goes through a
 * pull request and has a history. This module is the only thing that turns a
 * row into a plant, and it is deliberately strict: a row with a mistake is
 * rejected with its row number, never repaired or half-loaded. Bad plant data
 * is advice a gardener acts on.
 *
 * Pure, no I/O.
 */

export const PLANT_CSV_COLUMNS = [
  "scientific_name",
  "common_names",
  "family",
  "ph_min",
  "ph_optimum",
  "ph_max",
  "sun_min_hours",
  "sun_max_hours",
  "water_use",
  "drainage_tolerated",
  "zone_min",
  "zone_max",
  "mature_height_cm",
  "mature_width_cm",
  "bloom_start_month",
  "bloom_end_month",
  "native_status",
  "deer_resistant",
  "pollinator_value",
  "edible",
  "good_for_cutting",
  "toxicity_note",
  "curated_by",
  "review_status",
] as const;

export interface PlantRow {
  scientificName: string;
  commonNames: string[];
  family: string;
  phMin: number;
  phOptimum: number;
  phMax: number;
  sunMinHours: number;
  sunMaxHours: number;
  waterUse: WaterUse;
  drainageTolerated: string[];
  zoneMinOrdinal: number;
  zoneMaxOrdinal: number;
  matureHeightCm: number;
  matureWidthCm: number;
  bloomStartMonth: number | null;
  bloomEndMonth: number | null;
  nativeStatus: NativeStatus;
  deerResistant: boolean;
  pollinatorValue: "none" | "low" | "moderate" | "high";
  edible: boolean;
  goodForCutting: boolean;
  toxicityNote: string | null;
  curatedBy: string;
  reviewStatus: "draft" | "reviewed" | "published";
}

export interface PlantCsvResult {
  plants: PlantRow[];
  /** Each message starts with the spreadsheet row number (row 1 is the header). */
  errors: string[];
}

/** RFC 4180: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const clean = text.replace(/^﻿/, "");
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const list = (raw: string) =>
  raw
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s !== "");

function parseBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (["yes", "true", "y", "1"].includes(v)) return true;
  if (["no", "false", "n", "0", ""].includes(v)) return false;
  return null;
}

/**
 * Parse and validate the whole sheet. Collects every error rather than
 * stopping at the first, so a reviewer fixes the sheet once, not once per run.
 */
export function parsePlantCsv(text: string): PlantCsvResult {
  const rows = parseCsv(text);
  const header = (rows[0] ?? []).map((h) => h.trim());

  const missing = PLANT_CSV_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return { plants: [], errors: [`Header is missing columns: ${missing.join(", ")}`] };
  }
  const index = Object.fromEntries(PLANT_CSV_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<
    (typeof PLANT_CSV_COLUMNS)[number],
    number
  >;

  const plants: PlantRow[] = [];
  const errors: string[] = [];
  const seen = new Map<string, number>();

  rows.slice(1).forEach((cells, i) => {
    const rowNumber = i + 2;
    const problems: string[] = [];
    const get = (c: (typeof PLANT_CSV_COLUMNS)[number]) => (cells[index[c]] ?? "").trim();
    const required = (c: (typeof PLANT_CSV_COLUMNS)[number]) => {
      const v = get(c);
      if (v === "") problems.push(`${c} is empty`);
      return v;
    };
    const number = (c: (typeof PLANT_CSV_COLUMNS)[number], min: number, max: number) => {
      const raw = required(c);
      const n = Number(raw);
      if (raw !== "" && (Number.isNaN(n) || n < min || n > max)) problems.push(`${c} "${raw}" is not a number from ${min} to ${max}`);
      return n;
    };
    const month = (c: "bloom_start_month" | "bloom_end_month") => {
      const raw = get(c);
      if (raw === "") return null;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 12) problems.push(`${c} "${raw}" is not a month from 1 to 12`);
      return n;
    };
    const flag = (c: "deer_resistant" | "edible" | "good_for_cutting") => {
      const b = parseBool(get(c));
      if (b === null) problems.push(`${c} "${get(c)}" must be yes or no`);
      return b ?? false;
    };

    const scientificName = required("scientific_name");
    const commonNames = list(get("common_names"));
    if (commonNames.length === 0) problems.push("common_names is empty");
    const family = required("family");

    const phMin = number("ph_min", 0, 14);
    const phOptimum = number("ph_optimum", 0, 14);
    const phMax = number("ph_max", 0, 14);
    if (!(phMin <= phOptimum && phOptimum <= phMax)) problems.push("pH must satisfy min <= optimum <= max");

    const sunMin = number("sun_min_hours", 0, 24);
    const sunMax = number("sun_max_hours", 0, 24);
    if (sunMin > sunMax) problems.push("sun_min_hours is greater than sun_max_hours");

    const water = waterUseSchema.safeParse(get("water_use"));
    if (!water.success) problems.push(`water_use "${get("water_use")}" must be one of very_low, low, moderate, high`);

    const drainage = list(get("drainage_tolerated"));
    if (drainage.length === 0) problems.push("drainage_tolerated is empty");
    for (const d of drainage) {
      if (!drainageClassSchema.safeParse(d).success) problems.push(`drainage_tolerated has unknown class "${d}"`);
    }

    const zoneMin = zoneToOrdinal(get("zone_min"));
    const zoneMax = zoneToOrdinal(get("zone_max"));
    if (zoneMin === null) problems.push(`zone_min "${get("zone_min")}" is not a zone such as 5a`);
    if (zoneMax === null) problems.push(`zone_max "${get("zone_max")}" is not a zone such as 8b`);
    if (zoneMin !== null && zoneMax !== null && zoneMin > zoneMax) problems.push("zone_min is warmer than zone_max");

    const heightCm = number("mature_height_cm", 1, 6000);
    const widthCm = number("mature_width_cm", 1, 6000);

    const bloomStart = month("bloom_start_month");
    const bloomEnd = month("bloom_end_month");
    if ((bloomStart === null) !== (bloomEnd === null)) problems.push("give both bloom months or neither");

    const nativeStatus = nativeStatusSchema.safeParse(get("native_status"));
    if (!nativeStatus.success) problems.push(`native_status "${get("native_status")}" must be one of native, regionally_native, adapted, introduced`);

    const pollinator = get("pollinator_value");
    if (!["none", "low", "moderate", "high"].includes(pollinator)) problems.push(`pollinator_value "${pollinator}" must be none, low, moderate or high`);

    const status = get("review_status");
    if (!["draft", "reviewed", "published"].includes(status)) problems.push(`review_status "${status}" must be draft, reviewed or published`);

    const curatedBy = get("curated_by");
    // Plant data needs a real person's name on it once anyone but its author has seen it.
    if (status !== "draft" && curatedBy === "") problems.push("a reviewed or published plant needs curated_by");

    const deerResistant = flag("deer_resistant");
    const edible = flag("edible");
    const goodForCutting = flag("good_for_cutting");

    const key = scientificName.toLowerCase();
    if (scientificName !== "") {
      const earlier = seen.get(key);
      if (earlier !== undefined) problems.push(`duplicates row ${earlier}`);
      else seen.set(key, rowNumber);
    }

    if (problems.length > 0) {
      errors.push(...problems.map((p) => `Row ${rowNumber}${scientificName ? ` (${scientificName})` : ""}: ${p}`));
      return;
    }

    plants.push({
      scientificName,
      commonNames,
      family,
      phMin,
      phOptimum,
      phMax,
      sunMinHours: sunMin,
      sunMaxHours: sunMax,
      waterUse: water.success ? water.data : "moderate",
      drainageTolerated: drainage,
      zoneMinOrdinal: zoneMin!,
      zoneMaxOrdinal: zoneMax!,
      matureHeightCm: heightCm,
      matureWidthCm: widthCm,
      bloomStartMonth: bloomStart,
      bloomEndMonth: bloomEnd,
      nativeStatus: nativeStatus.success ? nativeStatus.data : "native",
      deerResistant,
      pollinatorValue: pollinator as PlantRow["pollinatorValue"],
      edible,
      goodForCutting,
      toxicityNote: get("toxicity_note") || null,
      curatedBy,
      reviewStatus: status as PlantRow["reviewStatus"],
    });
  });

  return { plants, errors };
}
