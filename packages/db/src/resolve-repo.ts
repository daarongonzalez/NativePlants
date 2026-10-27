import { and, desc, eq, sql } from "drizzle-orm";
import type { PlantRow } from "@np/shared";
import type { Database } from "./client";
import type { Owner } from "./repositories";
import {
  climateStations,
  dataProvenance,
  frostNorms,
  hardinessZones,
  plants,
  siteProfiles,
  sites,
  soilMapUnits,
  soilProperties,
} from "./schema";

/** Reference-data reads used by the resolve pipeline. Not owner-scoped — this is public data. */

export async function lookupZoneByZip(db: Database, zip: string) {
  const rows = await db
    .select()
    .from(hardinessZones)
    .where(eq(hardinessZones.zip, zip))
    .limit(1);

  return rows[0] ?? null;
}

export interface NearestStation {
  stationId: string;
  name: string;
  elevationM: number | null;
  distanceM: number;
  frost: typeof frostNorms.$inferSelect;
}

/**
 * Nearest climate station that actually has frost normals.
 *
 * The `<->` operator is a KNN search that uses the GiST index, so this stays
 * fast as the station table grows. Distance is measured by casting to
 * `geography`, which gives metres on the spheroid — `ST_Distance` on raw
 * 4326 geometry returns degrees, which is a meaningless unit here and a
 * common source of silently wrong "nearest" answers.
 *
 * The inner join on frost_norms matters: a station with no normals is not a
 * useful answer, and ordering by distance before filtering would return one.
 */
export async function findNearestStation(
  db: Database,
  latitude: number,
  longitude: number,
): Promise<NearestStation | null> {
  const point = sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)`;

  const rows = await db
    .select({
      stationId: climateStations.id,
      name: climateStations.name,
      elevationM: climateStations.elevationM,
      distanceM: sql<number>`ST_Distance(${climateStations.geom}::geography, ${point}::geography)`,
      frost: frostNorms,
    })
    .from(climateStations)
    .innerJoin(frostNorms, eq(frostNorms.stationId, climateStations.id))
    .orderBy(sql`${climateStations.geom} <-> ${point}`)
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Write a new profile snapshot.
 *
 * Always an insert, never an update. Two reasons: a recommendation must be
 * reproducible from the profile it was generated against, and a gardener
 * should be able to see that their profile is six months old.
 *
 * Owner-scoped via an explicit ownership check first — a profile is derived
 * user data, and writing one for someone else's site would be a cross-account
 * write.
 */
export async function createSiteProfile(
  db: Database,
  owner: Owner,
  siteId: string,
  values: Omit<typeof siteProfiles.$inferInsert, "siteId">,
) {
  const owned = await db
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.userId, owner.userId)))
    .limit(1);

  if (!owned[0]) return null;

  const rows = await db
    .insert(siteProfiles)
    .values({ ...values, siteId })
    .returning();

  return rows[0] ?? null;
}

export async function countProfiles(db: Database, owner: Owner, siteId: string) {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(siteProfiles)
    .innerJoin(sites, eq(sites.id, siteProfiles.siteId))
    .where(and(eq(siteProfiles.siteId, siteId), eq(sites.userId, owner.userId)));

  return rows[0]?.n ?? 0;
}

/** Update a site's coordinates after geocoding. Owner-scoped. */
export async function setSiteLocation(
  db: Database,
  owner: Owner,
  siteId: string,
  input: { latitude: number; longitude: number; addressText: string },
) {
  const rows = await db
    .update(sites)
    .set({
      addressText: input.addressText,
      geom: sql`ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)`,
    })
    .where(and(eq(sites.id, siteId), eq(sites.userId, owner.userId)))
    .returning({ id: sites.id });

  return rows.length > 0;
}

/**
 * Record where an ingested row came from.
 *
 * One row per (table, record, source). Ingestion runs repeatedly, and a plain
 * insert added a fresh row for every ZIP and station on every run, so the
 * table grew without bound and a reader could not tell which row described the
 * current value. If a row for that source already exists it is refreshed in
 * place (new citation, URL and retrieval date); a different source gets its
 * own row.
 *
 * Called by ingestion jobs, never by a request. Jobs run one at a time (the
 * workflows share a concurrency group), so there is no race between the lookup
 * and the write.
 */
export async function recordProvenance(
  db: Database,
  entries: (typeof dataProvenance.$inferInsert)[],
) {
  for (const entry of entries) {
    const existing = await db
      .select({ id: dataProvenance.id })
      .from(dataProvenance)
      .where(
        and(
          eq(dataProvenance.tableName, entry.tableName),
          eq(dataProvenance.recordId, entry.recordId),
          eq(dataProvenance.source, entry.source),
        ),
      )
      .limit(1);

    const found = existing[0];
    if (found) {
      await db
        .update(dataProvenance)
        .set({
          license: entry.license ?? null,
          citation: entry.citation ?? null,
          sourceUrl: entry.sourceUrl ?? null,
          retrievedAt: entry.retrievedAt,
        })
        .where(eq(dataProvenance.id, found.id));
    } else {
      await db.insert(dataProvenance).values(entry);
    }
  }
}

export async function latestProfileForSite(db: Database, owner: Owner, siteId: string) {
  const rows = await db
    .select({ profile: siteProfiles })
    .from(siteProfiles)
    .innerJoin(sites, eq(sites.id, siteProfiles.siteId))
    .where(and(eq(siteProfiles.siteId, siteId), eq(sites.userId, owner.userId)))
    .orderBy(desc(siteProfiles.resolvedAt))
    .limit(1);

  return rows[0]?.profile ?? null;
}

export interface SoilAtPoint {
  mukey: string;
  name: string;
  surveyArea: string;
  drainageClass: string | null;
  horizons: (typeof soilProperties.$inferSelect)[];
}

/**
 * The soil map unit under a point, with its horizons.
 *
 * `ST_Covers` rather than `ST_Intersects` so a point exactly on a boundary
 * still lands in one unit. Returns null when the point is in no mapped unit —
 * water, or ground the county survey left out — which the caller must report
 * rather than paper over. A unit with no horizons (urban land, rock outcrop)
 * comes back with an empty list for the same reason.
 */
export async function findSoilAtPoint(
  db: Database,
  latitude: number,
  longitude: number,
): Promise<SoilAtPoint | null> {
  const point = sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)`;

  const units = await db
    .select({ mukey: soilMapUnits.mukey, name: soilMapUnits.name, surveyArea: soilMapUnits.surveyArea })
    .from(soilMapUnits)
    .where(sql`ST_Covers(${soilMapUnits.geom}, ${point})`)
    .limit(1);

  const unit = units[0];
  if (!unit) return null;

  const horizons = await db
    .select()
    .from(soilProperties)
    .where(eq(soilProperties.mukey, unit.mukey))
    .orderBy(soilProperties.depthTopCm);

  return {
    ...unit,
    drainageClass: horizons.find((h) => h.drainageClass !== null)?.drainageClass ?? null,
    horizons,
  };
}

/** Frost normals for one station. Reference data, not owner-scoped. */
export async function getFrostNorms(db: Database, stationId: string) {
  const rows = await db.select().from(frostNorms).where(eq(frostNorms.stationId, stationId)).limit(1);
  return rows[0] ?? null;
}

/**
 * Insert or update curated plants for a market, keyed on scientific name.
 *
 * A re-import of the same sheet updates rows in place rather than adding
 * duplicates, and returns each plant's id so the caller can record provenance.
 * Called by the plant import job, never by a request.
 */
export async function upsertPlants(
  db: Database,
  market: string,
  rows: readonly PlantRow[],
  curatedAt: Date,
): Promise<{ id: string; scientificName: string }[]> {
  const written: { id: string; scientificName: string }[] = [];
  for (const row of rows) {
    const values = { ...row, market, curatedAt };
    const result = await db
      .insert(plants)
      .values(values)
      .onConflictDoUpdate({ target: [plants.scientificName, plants.market], set: values })
      .returning({ id: plants.id, scientificName: plants.scientificName });
    written.push(result[0]!);
  }
  return written;
}
