import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createDatabase, type Database } from "./client";
import { createSite } from "./repositories";
import {
  countProfiles,
  createSiteProfile,
  findNearestStation,
  findSoilAtPoint,
  getFrostNorms,
  lookupZoneByZip,
  recordProvenance,
  upsertPlants,
} from "./resolve-repo";
import { listPublishedPlants } from "./repositories";
import { toDomainPlant } from "./mappers";
import { parsePlantCsv, plantSchema, PLANT_CSV_COLUMNS } from "@np/shared";
import { multiPolygonFromWkt } from "./geometry";
import {
  climateStations,
  dataProvenance,
  frostNorms,
  hardinessZones,
  plants,
  soilMapUnits,
  soilProperties,
  users,
} from "./schema";

/**
 * Integration tests for the resolve pipeline's data layer.
 *
 * These need a real Postgres with PostGIS — the nearest-station query uses a
 * KNN operator and a geography cast that no in-memory fake reproduces, and
 * getting that query subtly wrong is the single most likely way this feature
 * ships broken.
 *
 * Skips without TEST_DATABASE_URL. A skip is not a pass.
 */
const url = process.env["TEST_DATABASE_URL"];
const describeIfDb = url ? describe : describe.skip;

// Real Wasatch Front geography, used so the distances below are checkable
// against a map rather than arbitrary.
const SLC_AIRPORT = { id: "TEST-KSLC", name: "Salt Lake City Intl", lat: 40.7884, lon: -111.9777, elevM: 1288 };
const HEBER = { id: "TEST-KHCR", name: "Heber Valley", lat: 40.4818, lon: -111.4288, elevM: 1719 };

describeIfDb("resolve data layer", () => {
  let db: Database;
  let owner: { userId: string };

  beforeAll(async () => {
    db = createDatabase(url!);

    const [u] = await db
      .insert(users)
      .values({ firebaseUid: `test-resolve-${Date.now()}`, email: "resolve@example.test" })
      .returning({ id: users.id });
    owner = { userId: u!.id };

    for (const s of [SLC_AIRPORT, HEBER]) {
      await db
        .insert(climateStations)
        .values({
          id: s.id,
          name: s.name,
          elevationM: s.elevM,
          geom: sql`ST_SetSRID(ST_MakePoint(${s.lon}, ${s.lat}), 4326)`,
        })
        .onConflictDoNothing();

      await db
        .insert(frostNorms)
        .values({
          stationId: s.id,
          lastSpringP10: "05-08",
          lastSpringP50: "04-24",
          lastSpringP90: "04-09",
          firstFallP10: "10-05",
          firstFallP50: "10-19",
          firstFallP90: "11-02",
          frostFreeDays: 178,
          normalsPeriod: "1991-2020",
        })
        .onConflictDoNothing();
    }

    await db
      .insert(hardinessZones)
      .values({ zip: "99999", zoneOrdinal: 72, tempMinF: 5, tempMaxF: 10, sourceYear: 2023 })
      .onConflictDoNothing();
  }, 60_000);

  afterAll(async () => {
    if (!db) return;
    await db.delete(users).where(eq(users.id, owner.userId));
    for (const s of [SLC_AIRPORT, HEBER]) {
      await db.delete(frostNorms).where(eq(frostNorms.stationId, s.id));
      await db.delete(climateStations).where(eq(climateStations.id, s.id));
    }
    await db.delete(hardinessZones).where(eq(hardinessZones.zip, "99999"));
  });

  it("looks up a zone by ZIP", async () => {
    const zone = await lookupZoneByZip(db, "99999");
    expect(zone?.zoneOrdinal).toBe(72);
  });

  it("reads frost normals for a station, and null for one without", async () => {
    const norms = await getFrostNorms(db, SLC_AIRPORT.id);
    expect(norms?.lastSpringP50).toBe("04-24");
    expect(norms?.frostFreeDays).toBe(178);
    expect(await getFrostNorms(db, "TEST-NO-SUCH-STATION")).toBeNull();
  });

  it("returns null for an unknown ZIP rather than a default", async () => {
    expect(await lookupZoneByZip(db, "00000")).toBeNull();
  });

  it("finds the genuinely nearest station, not just any station", async () => {
    // Downtown Salt Lake City — much closer to the airport than to Heber.
    const station = await findNearestStation(db, 40.7608, -111.891);
    expect(station?.stationId).toBe(SLC_AIRPORT.id);
  });

  it("picks the other station from a location nearer to it", async () => {
    // Midway, Utah — right next to Heber.
    const station = await findNearestStation(db, 40.512, -111.474);
    expect(station?.stationId).toBe(HEBER.id);
  });

  it("reports distance in metres, not degrees", async () => {
    const station = await findNearestStation(db, 40.7608, -111.891);
    // Downtown SLC to the airport is roughly 9 km. If this came back as a
    // number under 1, the geography cast was dropped and the unit is degrees.
    expect(station!.distanceM).toBeGreaterThan(5_000);
    expect(station!.distanceM).toBeLessThan(15_000);
  });

  it("carries the station elevation through, which the confidence rule needs", async () => {
    const station = await findNearestStation(db, 40.7608, -111.891);
    expect(station!.elevationM).toBe(SLC_AIRPORT.elevM);
  });

  it("writes a profile snapshot and never updates in place", async () => {
    const site = await createSite(db, owner, {
      label: "Test yard",
      latitude: 40.7608,
      longitude: -111.891,
    });

    const first = await createSiteProfile(db, owner, site!.id, {
      zoneOrdinal: 72,
      provenance: { zoneOrdinal: { source: "usda_phzm", confidence: "medium", retrievedAt: new Date().toISOString() } },
    });
    const second = await createSiteProfile(db, owner, site!.id, {
      zoneOrdinal: 72,
      provenance: { zoneOrdinal: { source: "usda_phzm", confidence: "medium", retrievedAt: new Date().toISOString() } },
    });

    expect(first!.id).not.toBe(second!.id);
    expect(await countProfiles(db, owner, site!.id)).toBe(2);
  });

  it("refuses to write a profile for a site owned by someone else", async () => {
    const [other] = await db
      .insert(users)
      .values({ firebaseUid: `test-intruder-${Date.now()}`, email: "intruder@example.test" })
      .returning({ id: users.id });

    const site = await createSite(db, owner, {
      label: "Private yard",
      latitude: 40.7,
      longitude: -111.9,
    });

    const result = await createSiteProfile(db, { userId: other!.id }, site!.id, {
      zoneOrdinal: 99,
      provenance: {},
    });

    expect(result).toBeNull();
    expect(await countProfiles(db, owner, site!.id)).toBe(0);

    await db.delete(users).where(eq(users.id, other!.id));
  });

  it("records provenance once per source and refreshes it on a repeat run", async () => {
    const recordId = `TEST-PROV-${Date.now()}`;
    const entry = (citation: string, retrievedAt: Date, source = "usda_phzm") => ({
      tableName: "hardiness_zones",
      recordId,
      source,
      citation,
      sourceUrl: "https://example.test/a",
      retrievedAt,
    });
    const rows = () => db.select().from(dataProvenance).where(eq(dataProvenance.recordId, recordId));

    await recordProvenance(db, [entry("first", new Date("2026-01-01"))]);
    await recordProvenance(db, [entry("second", new Date("2026-02-01"))]);

    const afterRepeat = await rows();
    expect(afterRepeat).toHaveLength(1);
    expect(afterRepeat[0]!.citation).toBe("second");
    expect(afterRepeat[0]!.retrievedAt.toISOString()).toBe("2026-02-01T00:00:00.000Z");

    // A different source for the same record is a different claim.
    await recordProvenance(db, [entry("other", new Date("2026-03-01"), "other_source")]);
    expect(await rows()).toHaveLength(2);

    await db.delete(dataProvenance).where(eq(dataProvenance.recordId, recordId));
  });

  it("repairs a self-intersecting outline so point lookups still work", async () => {
    // A bow-tie: two triangles meeting at a point, which is invalid as one ring.
    const bowtie = "POLYGON((-111.80 40.70, -111.70 40.80, -111.70 40.70, -111.80 40.80, -111.80 40.70))";
    await db.insert(soilMapUnits).values({
      mukey: "TEST-SOIL-BOWTIE",
      name: "Bow-tie test unit",
      surveyArea: "UT-TEST",
      geom: multiPolygonFromWkt(bowtie),
    });
    try {
      const valid = await db.execute(sql`SELECT ST_IsValid(geom) AS ok FROM soil_map_units WHERE mukey = 'TEST-SOIL-BOWTIE'`);
      expect(valid.rows[0]?.["ok"]).toBe(true);
      // Inside the left lobe, and inside the right lobe.
      expect((await findSoilAtPoint(db, 40.75, -111.78))?.mukey).toBe("TEST-SOIL-BOWTIE");
      expect((await findSoilAtPoint(db, 40.75, -111.72))?.mukey).toBe("TEST-SOIL-BOWTIE");
    } finally {
      await db.delete(soilMapUnits).where(eq(soilMapUnits.mukey, "TEST-SOIL-BOWTIE"));
    }
  });

  it("finds the soil map unit under a point, with its horizons", async () => {
    // Two adjacent squares in the Salt Lake valley, so a point in each must
    // land in a different unit and a point in neither must return null.
    const square = (west: number, east: number) =>
      `MULTIPOLYGON(((${west} 40.70, ${east} 40.70, ${east} 40.80, ${west} 40.80, ${west} 40.70)))`;
    const units = [
      { mukey: "TEST-SOIL-W", west: -112.0, east: -111.9 },
      { mukey: "TEST-SOIL-E", west: -111.9, east: -111.8 },
    ];

    try {
      for (const u of units) {
        await db.insert(soilMapUnits).values({
          mukey: u.mukey,
          name: `Test unit ${u.mukey}`,
          surveyArea: "UT-TEST",
          geom: sql`ST_GeomFromText(${square(u.west, u.east)}, 4326)`,
        });
        await db.insert(soilProperties).values([
          { mukey: u.mukey, depthTopCm: 30, depthBottomCm: 90, ph: 8.2, drainageClass: "well_drained" },
          { mukey: u.mukey, depthTopCm: 0, depthBottomCm: 30, ph: 7.4, drainageClass: "well_drained" },
        ]);
      }

      const west = await findSoilAtPoint(db, 40.75, -111.95);
      expect(west?.mukey).toBe("TEST-SOIL-W");
      expect(west?.drainageClass).toBe("well_drained");
      // Ordered by depth, shallowest first, whatever order they were written in.
      expect(west?.horizons.map((h) => h.depthTopCm)).toEqual([0, 30]);

      expect((await findSoilAtPoint(db, 40.75, -111.85))?.mukey).toBe("TEST-SOIL-E");
      expect(await findSoilAtPoint(db, 40.75, -111.5)).toBeNull();
    } finally {
      const keys = units.map((u) => u.mukey);
      for (const key of keys) {
        await db.delete(soilProperties).where(eq(soilProperties.mukey, key));
        await db.delete(soilMapUnits).where(eq(soilMapUnits.mukey, key));
      }
    }
  });

  it("imports plants from sheet text, serves only published ones, and updates rather than duplicates", async () => {
    const market = `test-market-${Date.now()}`;
    const row = (name: string, status: string) =>
      [
        name, "Test plant|Sample", "Testaceae", "6.0", "7.0", "8.0", "6", "24", "low",
        "well_drained|moderately_well_drained", "4b", "8a", "60", "45", "5", "7", "native",
        "yes", "high", "no", "yes", "", "A. Reviewer", status,
      ].join(",");
    const sheet = (...rows: string[]) => [PLANT_CSV_COLUMNS.join(","), ...rows].join("\n");

    const first = parsePlantCsv(sheet(row("Testus publishedus", "published"), row("Testus draftus", "draft")));
    expect(first.errors).toEqual([]);

    try {
      await upsertPlants(db, market, first.plants, new Date());
      const served = await listPublishedPlants(db, market);
      expect(served.map((p) => p.scientificName)).toEqual(["Testus publishedus"]);

      // The stored row must satisfy the same schema the engine and API rely on.
      const stored = await db.select().from(plants).where(eq(plants.market, market));
      expect(stored).toHaveLength(2);
      for (const r of stored) expect(() => plantSchema.parse(toDomainPlant(r))).not.toThrow();
      expect(toDomainPlant(stored.find((r) => r.scientificName === "Testus publishedus")!)).toMatchObject({
        sun: { minHours: 6, maxHours: 24 },
        zoneMinOrdinal: 42,
        zoneMaxOrdinal: 81,
        drainageTolerated: ["well_drained", "moderately_well_drained"],
        commonNames: ["Test plant", "Sample"],
      });

      // Importing the same sheet again, with one change, updates in place.
      const second = parsePlantCsv(sheet(row("Testus publishedus", "published").replace(",6.0,7.0,8.0,", ",6.5,7.0,8.0,"), row("Testus draftus", "draft")));
      await upsertPlants(db, market, second.plants, new Date());
      const after = await db.select().from(plants).where(eq(plants.market, market));
      expect(after).toHaveLength(2);
      expect(after.find((r) => r.scientificName === "Testus publishedus")?.phMin).toBe(6.5);
    } finally {
      await db.delete(plants).where(eq(plants.market, market));
    }
  });
});
