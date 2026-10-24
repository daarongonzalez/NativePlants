import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLANT_CSV_COLUMNS, parseCsv, parsePlantCsv } from "@np/shared";

const header = PLANT_CSV_COLUMNS.join(",");

/** A valid row for a made-up plant. Tests change one field at a time. */
function row(overrides: Partial<Record<(typeof PLANT_CSV_COLUMNS)[number], string>> = {}): string {
  const base: Record<(typeof PLANT_CSV_COLUMNS)[number], string> = {
    scientific_name: "Testus plantus",
    common_names: "Test plant|Sample flower",
    family: "Testaceae",
    ph_min: "6.0",
    ph_optimum: "7.0",
    ph_max: "8.0",
    sun_min_hours: "6",
    sun_max_hours: "10",
    water_use: "low",
    drainage_tolerated: "well_drained|moderately_well_drained",
    zone_min: "4b",
    zone_max: "8a",
    mature_height_cm: "60",
    mature_width_cm: "45",
    bloom_start_month: "5",
    bloom_end_month: "7",
    native_status: "native",
    deer_resistant: "yes",
    pollinator_value: "high",
    edible: "no",
    good_for_cutting: "yes",
    toxicity_note: "",
    curated_by: "A. Reviewer",
    review_status: "reviewed",
  };
  return PLANT_CSV_COLUMNS.map((c) => {
    const v = overrides[c] ?? base[c];
    return v.includes(",") ? `"${v}"` : v;
  }).join(",");
}

const sheet = (...rows: string[]) => [header, ...rows].join("\n");

describe("parseCsv", () => {
  it("handles quoted commas, doubled quotes and CRLF", () => {
    expect(parseCsv('a,"b,c","d ""e"""\r\nf,g,h\r\n')).toEqual([
      ["a", "b,c", 'd "e"'],
      ["f", "g", "h"],
    ]);
  });

  it("skips blank lines", () => {
    expect(parseCsv("a,b\n\n,\nc,d\n")).toEqual([["a", "b"], ["c", "d"]]);
  });
});

describe("parsePlantCsv", () => {
  it("reads a valid row into a plant", () => {
    const { plants, errors } = parsePlantCsv(sheet(row()));
    expect(errors).toEqual([]);
    expect(plants[0]).toMatchObject({
      scientificName: "Testus plantus",
      commonNames: ["Test plant", "Sample flower"],
      zoneMinOrdinal: 42,
      zoneMaxOrdinal: 81,
      drainageTolerated: ["well_drained", "moderately_well_drained"],
      deerResistant: true,
      edible: false,
      toxicityNote: null,
    });
  });

  it("accepts a header-only sheet", () => {
    expect(parsePlantCsv(header)).toEqual({ plants: [], errors: [] });
  });

  it("reports a missing column instead of loading nothing", () => {
    const { errors } = parsePlantCsv("scientific_name,family\nX,Y");
    expect(errors[0]).toMatch(/missing columns/);
  });

  it("rejects pH out of order, with the row number", () => {
    const { plants, errors } = parsePlantCsv(sheet(row(), row({ scientific_name: "Bad ph", ph_min: "8", ph_max: "6" })));
    expect(plants).toHaveLength(1);
    expect(errors).toEqual(["Row 3 (Bad ph): pH must satisfy min <= optimum <= max"]);
  });

  it("rejects a reversed zone range, an unknown drainage class and a bad water class", () => {
    const { errors } = parsePlantCsv(
      sheet(row({ zone_min: "8a", zone_max: "4b", drainage_tolerated: "soggy", water_use: "lots" })),
    );
    expect(errors.join("\n")).toMatch(/zone_min is warmer/);
    expect(errors.join("\n")).toMatch(/unknown class "soggy"/);
    expect(errors.join("\n")).toMatch(/water_use "lots"/);
  });

  it("rejects reversed sun hours and a lone bloom month", () => {
    const { errors } = parsePlantCsv(sheet(row({ sun_min_hours: "10", sun_max_hours: "6", bloom_end_month: "" })));
    expect(errors.join("\n")).toMatch(/sun_min_hours is greater/);
    expect(errors.join("\n")).toMatch(/both bloom months or neither/);
  });

  it("requires a named curator once a plant is reviewed", () => {
    expect(parsePlantCsv(sheet(row({ curated_by: "", review_status: "published" }))).errors[0]).toMatch(/needs curated_by/);
    expect(parsePlantCsv(sheet(row({ curated_by: "", review_status: "draft" }))).errors).toEqual([]);
  });

  it("rejects the same species twice", () => {
    const { errors } = parsePlantCsv(sheet(row(), row({ scientific_name: "testus PLANTUS" })));
    expect(errors).toEqual(["Row 3 (testus PLANTUS): duplicates row 2"]);
  });

  it("does not guess at a yes/no it cannot read", () => {
    expect(parsePlantCsv(sheet(row({ deer_resistant: "sometimes" }))).errors[0]).toMatch(/must be yes or no/);
  });

  it("keeps a toxicity note when one is given", () => {
    const { plants } = parsePlantCsv(sheet(row({ toxicity_note: "Toxic to dogs and cats if eaten" })));
    expect(plants[0]!.toxicityNote).toBe("Toxic to dogs and cats if eaten");
  });
});

describe("the committed plant sheet", () => {
  const text = readFileSync(new URL("../../../data/plants/wasatch-plants.csv", import.meta.url), "utf8");

  it("passes validation as committed", () => {
    expect(parsePlantCsv(text).errors).toEqual([]);
  });

  it("is never published without a named curator", () => {
    for (const p of parsePlantCsv(text).plants) {
      if (p.reviewStatus === "published") expect(p.curatedBy).not.toBe("");
    }
  });
});
