import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "./client.js";
import { createSite, deleteSite, getSite, listSites, savePlant } from "./repositories.js";
import { users } from "./schema.js";
import { eq } from "drizzle-orm";

/**
 * The cross-account access suite.
 *
 * Every user-owned table gets an attempt to read or write it as the wrong
 * user, and every attempt must come back empty. This is the primary
 * authorization defence — not Postgres RLS, which leaks across pooled
 * connections unless every context set uses `SET LOCAL` inside an explicit
 * transaction.
 *
 * Needs a real Postgres with PostGIS. Set TEST_DATABASE_URL to a scratch
 * database; the suite skips without it rather than passing vacuously, so a
 * green CI run with no database configured is NOT evidence that scoping works.
 */
const url = process.env["TEST_DATABASE_URL"];
const describeIfDb = url ? describe : describe.skip;

describeIfDb("cross-account scoping", () => {
  let db: Database;
  let alice: { userId: string };
  let bob: { userId: string };
  let aliceSiteId: string;

  beforeAll(async () => {
    db = createDatabase(url!);

    const [a] = await db
      .insert(users)
      .values({ firebaseUid: `test-alice-${Date.now()}`, email: "alice@example.test" })
      .returning({ id: users.id });
    const [b] = await db
      .insert(users)
      .values({ firebaseUid: `test-bob-${Date.now()}`, email: "bob@example.test" })
      .returning({ id: users.id });

    alice = { userId: a!.id };
    bob = { userId: b!.id };

    const site = await createSite(db, alice, {
      label: "Alice's back yard",
      latitude: 40.7608,
      longitude: -111.891,
    });
    aliceSiteId = site!.id;
  });

  afterAll(async () => {
    if (!db) return;
    await db.delete(users).where(eq(users.id, alice.userId));
    await db.delete(users).where(eq(users.id, bob.userId));
  });

  it("does not let Bob read Alice's site", async () => {
    expect(await getSite(db, bob, aliceSiteId)).toBeNull();
  });

  it("does not list Alice's site for Bob", async () => {
    const bobSites = await listSites(db, bob);
    expect(bobSites.map((s) => s.id)).not.toContain(aliceSiteId);
  });

  it("does not let Bob delete Alice's site", async () => {
    expect(await deleteSite(db, bob, aliceSiteId)).toBe(false);
    expect(await getSite(db, alice, aliceSiteId)).not.toBeNull();
  });

  it("does not let Bob save a plant to Alice's site", async () => {
    const fakePlantId = "00000000-0000-4000-8000-000000000000";
    expect(await savePlant(db, bob, aliceSiteId, fakePlantId)).toBe(false);
  });

  it("still lets Alice read her own site", async () => {
    expect(await getSite(db, alice, aliceSiteId)).not.toBeNull();
  });
});
