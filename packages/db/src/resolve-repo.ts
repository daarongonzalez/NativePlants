import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "./client";
import type { Owner } from "./repositories";
import { climateStations, dataProvenance, frostNorms, hardinessZones, siteProfiles, sites } from "./schema";

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

/** Record where an ingested row came from. Called by ingestion jobs, never by a request. */
export async function recordProvenance(
  db: Database,
  entries: (typeof dataProvenance.$inferInsert)[],
) {
  if (entries.length === 0) return;
  await db.insert(dataProvenance).values(entries);
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
