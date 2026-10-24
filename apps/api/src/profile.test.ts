import { describe, expect, it } from "vitest";
import { siteProfileSchema } from "@np/shared";
import { toDomainProfile } from "./profile";

const prov = (source: string, confidence = "medium") => ({
  source,
  confidence,
  retrievedAt: "2026-10-01T00:00:00.000Z",
});

/** A fully resolved row, as createSiteProfile writes it plus the frost bands the route joins in. */
const stored = () => ({
  resolvedAt: new Date("2026-10-01T00:00:00Z"),
  zoneOrdinal: 72,
  frost: {
    lastSpringP10: "05-08",
    lastSpringP50: "04-24",
    lastSpringP90: "04-09",
    firstFallP10: "10-05",
    firstFallP50: "10-19",
    firstFallP90: "11-02",
    frostFreeDays: 178,
  },
  ph: 7.9,
  sandPct: 30,
  siltPct: 40,
  clayPct: 30,
  drainageClass: "well_drained",
  sunHoursSummer: 15.1,
  provenance: {
    zoneOrdinal: prov("usda_phzm", "low"),
    frost: prov("noaa_normals", "high"),
    ph: prov("ssurgo", "low"),
    sandPct: prov("ssurgo", "low"),
    siltPct: prov("ssurgo", "low"),
    clayPct: prov("ssurgo", "low"),
    drainageClass: prov("ssurgo", "low"),
    sunHoursSummer: prov("solar_geometry", "low"),
  },
});

const site = { latitude: 40.76, longitude: -111.89 };
const siteId = "11111111-1111-4111-8111-111111111111";

describe("toDomainProfile", () => {
  it("produces a profile the engine's schema accepts", () => {
    const result = toDomainProfile(stored(), site, siteId);
    expect("profile" in result).toBe(true);
    if ("profile" in result) expect(() => siteProfileSchema.parse(result.profile)).not.toThrow();
  });

  it("carries the recorded confidence rather than a made-up one", () => {
    const result = toDomainProfile(stored(), site, siteId);
    if (!("profile" in result)) throw new Error("expected a profile");
    const parsed = siteProfileSchema.parse(result.profile);
    expect(parsed.ph.provenance).toMatchObject({ source: "ssurgo", confidence: "low" });
    expect(parsed.sunHoursSummer.provenance.source).toBe("solar_geometry");
    expect(parsed.frost.provenance.confidence).toBe("high");
  });

  it("names every missing field instead of guessing", () => {
    const row = { ...stored(), ph: null, frost: null, sunHoursSummer: null };
    expect(toDomainProfile(row, site, siteId)).toEqual({ missing: ["frost", "ph", "sunHoursSummer"] });
  });

  it("treats a value with no recorded provenance as missing", () => {
    const row = stored();
    delete (row.provenance as Record<string, unknown>)["ph"];
    expect(toDomainProfile(row, site, siteId)).toEqual({ missing: ["ph"] });
  });
});
