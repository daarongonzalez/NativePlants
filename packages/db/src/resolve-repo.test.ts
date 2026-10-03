import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createDatabase, type Database } from "./client";
import { createSite } from "./repositories";
import { countProfiles, createSiteProfile, findNearestStation, lookupZoneByZip } from "./resolve-repo";
import { climateStations, frostNorms, hardinessZones, users } from "./schema";

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
});
