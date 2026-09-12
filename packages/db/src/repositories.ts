import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "./client.js";
import { toDomainPlant } from "./mappers.js";
import type { Plant } from "@np/shared";
import { plants, savedPlants, siteConstraints, siteProfiles, sites, users } from "./schema.js";

/**
 * The authorization boundary.
 *
 * Every function that touches a user-owned table takes an explicit `userId`
 * and puts it in the WHERE clause. Route handlers never build their own
 * queries against these tables.
 *
 * Why this, and not Postgres row-level security, as the primary defence:
 * Hyperdrive pools connections, and a session variable set with `SET` outlives
 * its transaction and leaks into whatever request borrows that connection
 * next. In a multi-tenant app that means one account reading another's rows.
 * RLS is worth adding on top — with `SET LOCAL` inside an explicit transaction
 * — but tested application scoping is what actually holds the line today.
 *
 * The invariant every function here must preserve: it is impossible to read or
 * write a row you do not own without passing someone else's id, and the test
 * suite proves that by trying.
 */

/** A caller's identity, resolved from a verified token. Never taken from a request body. */
export interface Owner {
  readonly userId: string;
}

export async function findOrCreateUser(
  db: Database,
  firebaseUid: string,
  email: string,
): Promise<{ id: string; role: string }> {
  const existing = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.firebaseUid, firebaseUid))
    .limit(1);

  const found = existing[0];
  if (found) return found;

  const inserted = await db
    .insert(users)
    .values({ firebaseUid, email })
    .onConflictDoUpdate({ target: users.firebaseUid, set: { email } })
    .returning({ id: users.id, role: users.role });

  const row = inserted[0];
  if (!row) throw new Error("failed to create user");
  return row;
}

export async function listSites(db: Database, owner: Owner) {
  return db
    .select({
      id: sites.id,
      label: sites.label,
      addressText: sites.addressText,
      longitude: sql<number>`ST_X(${sites.geom})`,
      latitude: sql<number>`ST_Y(${sites.geom})`,
      createdAt: sites.createdAt,
    })
    .from(sites)
    .where(eq(sites.userId, owner.userId))
    .orderBy(desc(sites.createdAt));
}

export async function getSite(db: Database, owner: Owner, siteId: string) {
  const rows = await db
    .select({
      id: sites.id,
      label: sites.label,
      addressText: sites.addressText,
      longitude: sql<number>`ST_X(${sites.geom})`,
      latitude: sql<number>`ST_Y(${sites.geom})`,
    })
    .from(sites)
    // Both predicates, always. Dropping the userId here is the bug this
    // whole module exists to prevent.
    .where(and(eq(sites.id, siteId), eq(sites.userId, owner.userId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function createSite(
  db: Database,
  owner: Owner,
  input: {
    label: string;
    latitude: number;
    longitude: number;
    addressText?: string | undefined;
  },
) {
  const rows = await db
    .insert(sites)
    .values({
      userId: owner.userId,
      label: input.label,
      addressText: input.addressText ?? null,
      geom: sql`ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)`,
    })
    .returning({ id: sites.id, label: sites.label });

  return rows[0] ?? null;
}

export async function getLatestProfile(db: Database, owner: Owner, siteId: string) {
  const rows = await db
    .select({ profile: siteProfiles })
    .from(siteProfiles)
    .innerJoin(sites, eq(sites.id, siteProfiles.siteId))
    .where(and(eq(siteProfiles.siteId, siteId), eq(sites.userId, owner.userId)))
    .orderBy(desc(siteProfiles.resolvedAt))
    .limit(1);

  return rows[0]?.profile ?? null;
}

export async function getConstraints(db: Database, owner: Owner, siteId: string) {
  const rows = await db
    .select({ constraints: siteConstraints })
    .from(siteConstraints)
    .innerJoin(sites, eq(sites.id, siteConstraints.siteId))
    .where(and(eq(siteConstraints.siteId, siteId), eq(sites.userId, owner.userId)))
    .limit(1);

  return rows[0]?.constraints ?? null;
}

export async function deleteSite(db: Database, owner: Owner, siteId: string) {
  const rows = await db
    .delete(sites)
    .where(and(eq(sites.id, siteId), eq(sites.userId, owner.userId)))
    .returning({ id: sites.id });

  return rows.length > 0;
}

export async function savePlant(db: Database, owner: Owner, siteId: string, plantId: string) {
  const site = await getSite(db, owner, siteId);
  if (!site) return false;

  await db
    .insert(savedPlants)
    .values({ userId: owner.userId, siteId, plantId })
    .onConflictDoNothing();

  return true;
}

export async function listSavedPlants(db: Database, owner: Owner, siteId: string) {
  const rows = await db
    .select({ plant: plants, savedAt: savedPlants.createdAt })
    .from(savedPlants)
    .innerJoin(plants, eq(plants.id, savedPlants.plantId))
    .where(and(eq(savedPlants.siteId, siteId), eq(savedPlants.userId, owner.userId)))
    .orderBy(desc(savedPlants.createdAt));

  return rows.map((r) => ({ plant: toDomainPlant(r.plant), savedAt: r.savedAt }));
}

/**
 * The published catalogue for a market. Reference data, deliberately not
 * owner-scoped — but only `published` rows are ever served, so a half-finished
 * curation pass cannot reach a gardener.
 */
export async function listPublishedPlants(db: Database, market: string): Promise<Plant[]> {
  const rows = await db
    .select()
    .from(plants)
    .where(and(eq(plants.market, market), eq(plants.reviewStatus, "published")));

  return rows.map(toDomainPlant);
}
