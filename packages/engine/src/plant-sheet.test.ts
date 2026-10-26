import { describe, expect, it } from "vitest";
import { PLANT_CSV_COLUMNS, parsePlantCsv, plantSchema, type Plant, type PlantRow, type SiteProfile } from "@np/shared";
import { recommend } from "./score";
import { sltSunnyClay } from "./__fixtures__/wasatch";

/**
 * The whole plant path short of the database: sheet text in, ranked advice out.
 *
 * The curation sheet, the importer and the scoring engine are written in three
 * places and agree only by convention (drainage class names, zone ordinals,
 * sun hours as direct hours). This test is where that agreement is checked, so a
 * sheet the reviewer fills in correctly cannot be silently misread by the engine.
 *
 * The plants below are invented to exercise the rules. They are not horticultural
 * claims and must never be copied into the real sheet.
 */

const cells = (v: Record<string, string>) => PLANT_CSV_COLUMNS.map((c) => v[c] ?? "").join(",");

const base = {
  common_names: "Test",
  family: "Testaceae",
  water_use: "low",
  zone_min: "4b",
  zone_max: "8a",
  mature_height_cm: "60",
  mature_width_cm: "45",
  native_status: "native",
  deer_resistant: "yes",
  pollinator_value: "high",
  edible: "no",
  good_for_cutting: "no",
  curated_by: "Test",
  review_status: "reviewed",
};

const SHEET = [
  PLANT_CSV_COLUMNS.join(","),
  // Loves sun and alkaline ground; sun_max of 24 so an unshaded yard never counts against it.
  cells({ ...base, scientific_name: "Sunny alkalinus", ph_min: "6.5", ph_optimum: "7.8", ph_max: "8.6", sun_min_hours: "6", sun_max_hours: "24", drainage_tolerated: "well_drained|moderately_well_drained|somewhat_excessively_drained" }),
  // Wants acid, wet, shady ground: should be ruled out on this site.
  cells({ ...base, scientific_name: "Shady acidophilus", ph_min: "4.5", ph_optimum: "5.5", ph_max: "6.2", sun_min_hours: "2", sun_max_hours: "5", drainage_tolerated: "poorly_drained|very_poorly_drained" }),
  // Fine on pH and drainage but wants part shade: should rank below the sun lover on an unshaded yard.
  cells({ ...base, scientific_name: "Partial adaptabilis", ph_min: "6.5", ph_optimum: "7.6", ph_max: "8.6", sun_min_hours: "3", sun_max_hours: "6", drainage_tolerated: "well_drained|moderately_well_drained" }),
].join("\n");

function toPlant(row: PlantRow, n: number): Plant {
  const { sunMinHours, sunMaxHours, ...rest } = row;
  return plantSchema.parse({
    ...rest,
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    sun: { minHours: sunMinHours, maxHours: sunMaxHours },
    curatedAt: "2026-10-26T00:00:00.000Z",
  });
}

const { plants: rows, errors } = parsePlantCsv(SHEET);
const catalogue = rows.map(toPlant);

/** The fixture is a sunny alkaline clay yard; this one has sun set the way an unanswered question would. */
const unshaded: SiteProfile = {
  ...sltSunnyClay,
  sunHoursSummer: { value: 15.1, provenance: { source: "solar_geometry", confidence: "low", retrievedAt: "2026-10-26T00:00:00.000Z" } },
};

describe("sheet text to recommendations", () => {
  it("parses the sample sheet cleanly", () => {
    expect(errors).toEqual([]);
    expect(catalogue).toHaveLength(3);
  });

  it("rules out the acid-loving plant and says why", () => {
    const { rejected } = recommend(unshaded, catalogue, { pollinators: false, lowWater: false, deerResistant: false, cutFlowers: false, edible: false });
    const out = rejected.find((r) => r.plant.scientificName === "Shady acidophilus");
    expect(out).toBeDefined();
    // The site's pH (8.0) is above this plant's maximum (6.2) by more than the tolerance.
    expect(out!.exclusion).toMatchObject({ kind: "ph_too_high", sitePh: 8.0, plantMax: 6.2 });
  });

  it("ranks the sun lover first on an unshaded yard, with explanations on every component", () => {
    const { recommended } = recommend(unshaded, catalogue, { pollinators: false, lowWater: false, deerResistant: false, cutFlowers: false, edible: false });
    expect(recommended.map((r) => r.plant.scientificName)).toEqual(["Sunny alkalinus", "Partial adaptabilis"]);
    expect(recommended[0]!.score).toBeGreaterThan(recommended[1]!.score);
    expect(recommended[0]!.components.find((c) => c.name === "sun")!.explanation).toMatch(/hours of summer sun/);
  });

  it("lets the part-shade plant catch up once the gardener says the spot is part sun", () => {
    const partSun: SiteProfile = {
      ...unshaded,
      sunHoursSummer: { value: 4.5, provenance: { source: "user_reported", confidence: "medium", retrievedAt: "2026-10-26T00:00:00.000Z" } },
    };
    const { recommended } = recommend(partSun, catalogue, { pollinators: false, lowWater: false, deerResistant: false, cutFlowers: false, edible: false });
    expect(recommended[0]!.plant.scientificName).toBe("Partial adaptabilis");
  });
});
