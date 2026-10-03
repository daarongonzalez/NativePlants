import { describe, expect, it } from "vitest";
import { FROST_ELEVATION_TOLERANCE_M, frostConfidence, zoneConfidence } from "./confidence";

describe("frost confidence", () => {
  it("trusts a station at a similar elevation", () => {
    const result = frostConfidence(1320, 1300);
    expect(result.confidence).toBe("high");
    expect(result.note).toBe("");
  });

  it("stays high right at the tolerance boundary", () => {
    const result = frostConfidence(1300 + FROST_ELEVATION_TOLERANCE_M, 1300);
    expect(result.confidence).toBe("high");
  });

  it("drops confidence just past the boundary", () => {
    const result = frostConfidence(1300 + FROST_ELEVATION_TOLERANCE_M + 1, 1300);
    expect(result.confidence).toBe("medium");
    expect(result.note).not.toBe("");
  });

  it("warns in the dangerous direction when the site is above the station", () => {
    // A bench address at ~5,200 ft, station at the SLC valley floor ~4,230 ft.
    const result = frostConfidence(1585, 1289);
    expect(result.confidence).toBe("medium");
    expect(result.note).toMatch(/below your address/);
    expect(result.note).toMatch(/last spring frost is likely later/);
    expect(result.elevationDifferenceM).toBeGreaterThan(0);
  });

  it("says the season is longer when the site is below the station", () => {
    const result = frostConfidence(1289, 1585);
    expect(result.confidence).toBe("medium");
    expect(result.note).toMatch(/above your address/);
    expect(result.note).toMatch(/season is likely a little longer/);
    expect(result.elevationDifferenceM).toBeLessThan(0);
  });

  it("reports the difference in feet, which is what a US gardener reads", () => {
    const result = frostConfidence(1585, 1289);
    // 296 m is about 971 ft.
    expect(result.note).toMatch(/9\d\d ft/);
  });

  it("lowers confidence when an elevation is missing rather than assuming", () => {
    expect(frostConfidence(null, 1300).confidence).toBe("medium");
    expect(frostConfidence(1300, null).confidence).toBe("medium");
    expect(frostConfidence(null, null).note).toMatch(/could not compare/i);
  });
});

describe("zone confidence", () => {
  it("never claims high confidence, because a zone comes from a ZIP", () => {
    for (const quality of ["rooftop", "interpolated", "approximate"]) {
      expect(zoneConfidence(quality)).not.toBe("high");
    }
  });

  it("is lower for an interpolated address than a rooftop match", () => {
    expect(zoneConfidence("rooftop")).toBe("medium");
    expect(zoneConfidence("interpolated")).toBe("low");
  });
});
