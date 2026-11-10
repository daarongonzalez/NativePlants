import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { PLANT_CSV_COLUMNS, parsePlantCsv } from "@np/shared";
import { createDatabase, type Database } from "./client";
import { upsertPlants } from "./resolve-repo";
import { listPlantsForReview, loadImageCandidates, recordPlantReview } from "./review-repo";
import { listPublishedPlants } from "./repositories";
import { plants } from "./schema";

/**
 * The plant review against a real Postgres: decisions stick through a sheet
 * reload, a change of facts sends a plant back, and photo decisions survive
 * a fresh photo search. Skips without TEST_DATABASE_URL; CI fails on a skip.
 */
const url = process.env["TEST_DATABASE_URL"];
const describeIfDb = url ? describe : describe.skip;

const row = (name: string, status: string, phMin = "6.0") =>
  [
    name, "Test plant|Sample", "Testaceae", phMin, "7.0", "8.0", "6", "24", "low",
    "well_drained|moderately_well_drained", "4b", "8a", "60", "45", "perennial", "wildflower", "yes", "5", "7", "native",
    "yes", "high", "no", "yes", "", "Claude draft (unreviewed)", status,
  ].join(",");
const sheet = (...rows: string[]) => parsePlantCsv([PLANT_CSV_COLUMNS.join(","), ...rows].join("\n")).plants;

const candidate = (id: number) => ({
  source: "inaturalist",
  photoId: id,
  imageUrl: `https://example.org/${id}/large.jpg`,
  thumbUrl: `https://example.org/${id}/medium.jpg`,
  pageUrl: `https://example.org/photos/${id}`,
  license: "CC BY",
  credit: `(c) Photographer ${id}, some rights reserved (CC BY)`,
});

describeIfDb("plant review", () => {
  let db: Database;
  const market = `test-review-${Date.now()}`;

  beforeAll(() => {
    db = createDatabase(url!);
  });
  afterAll(async () => {
    await db.delete(plants).where(eq(plants.market, market));
  });

  it("runs a review from first load to approval and back", async () => {
    await upsertPlants(db, market, sheet(row("Testus reviewus", "draft")), new Date());
    const photos = await loadImageCandidates(db, market, {
      "Testus reviewus": [candidate(1), candidate(2)],
      "Testus missingus": [candidate(3)],
    });
    expect(photos).toEqual({ written: 2, unknownPlants: ["Testus missingus"] });

    let [plant] = await listPlantsForReview(db, market);
    expect(plant).toMatchObject({ reviewStatus: "draft", reviewedBy: null });
    expect(plant!.media.map((m) => m.reviewStatus)).toEqual(["candidate", "candidate"]);
    expect(await listPublishedPlants(db, market)).toHaveLength(0);

    // Approve the plant and one photo; reject the other.
    const [p1, p2] = plant!.media;
    const saved = await recordPlantReview(db, {
      plantId: plant!.id,
      market,
      reviewerEmail: "rachel@example.com",
      decision: "pass",
      notes: "Looks right.",
      spriteCheck: "ok",
      images: [
        { mediaId: p1!.id, status: "approved", kind: "habit", note: null },
        { mediaId: p2!.id, status: "rejected", kind: "detail", note: "Blurry" },
      ],
    });
    expect(saved?.plant.reviewStatus).toBe("published");
    expect(await listPublishedPlants(db, market)).toHaveLength(1);

    [plant] = await listPlantsForReview(db, market);
    expect(plant).toMatchObject({ reviewStatus: "published", reviewedBy: "rachel@example.com" });
    expect(plant!.media.find((m) => m.id === p1!.id)).toMatchObject({ reviewStatus: "approved", kind: "habit" });
    // A rejected photo has no use, whatever was sent.
    expect(plant!.media.find((m) => m.id === p2!.id)).toMatchObject({ reviewStatus: "rejected", kind: null, reviewNote: "Blurry" });
    expect(plant!.reviews[0]).toMatchObject({ decision: "pass", spriteCheck: "ok", factsHash: plant!.factsHash });

    // Reloading the same sheet, even one still saying "draft", keeps the approval.
    await upsertPlants(db, market, sheet(row("Testus reviewus", "draft")), new Date());
    [plant] = await listPlantsForReview(db, market);
    expect(plant!.reviewStatus).toBe("published");

    // A fresh photo search refreshes links but keeps decisions.
    await loadImageCandidates(db, market, { "Testus reviewus": [candidate(1), candidate(2)] });
    [plant] = await listPlantsForReview(db, market);
    expect(plant!.media.find((m) => m.id === p1!.id)?.reviewStatus).toBe("approved");

    // Changing a fact sends the plant back for review.
    await upsertPlants(db, market, sheet(row("Testus reviewus", "draft", "6.5")), new Date());
    [plant] = await listPlantsForReview(db, market);
    expect(plant).toMatchObject({ reviewStatus: "draft", reviewedBy: null, phMin: 6.5 });
    expect(plant!.reviews[0]!.factsHash).not.toBe(plant!.factsHash);
    expect(await listPublishedPlants(db, market)).toHaveLength(0);
  });

  it("will not touch a plant in another market, or another plant's photos", async () => {
    const other = `${market}-other`;
    try {
      await upsertPlants(db, market, sheet(row("Testus alphus", "draft")), new Date());
      await upsertPlants(db, other, sheet(row("Testus betus", "draft")), new Date());
      await loadImageCandidates(db, other, { "Testus betus": [candidate(9)] });
      const [beta] = await listPlantsForReview(db, other);
      const alpha = (await listPlantsForReview(db, market)).find((p) => p.scientificName === "Testus alphus")!;

      expect(
        await recordPlantReview(db, {
          plantId: beta!.id,
          market,
          reviewerEmail: "rachel@example.com",
          decision: "pass",
          notes: null,
          spriteCheck: null,
          images: [],
        }),
      ).toBeNull();

      // Alpha's decision naming beta's photo leaves the photo alone.
      await recordPlantReview(db, {
        plantId: alpha.id,
        market,
        reviewerEmail: "rachel@example.com",
        decision: "fail",
        notes: "Wrong height",
        spriteCheck: "none",
        images: [{ mediaId: beta!.media[0]!.id, status: "rejected", kind: null, note: null }],
      });
      const [betaAfter] = await listPlantsForReview(db, other);
      expect(betaAfter!.media[0]!.reviewStatus).toBe("candidate");
      expect(betaAfter!.reviewStatus).toBe("draft");
    } finally {
      await db.delete(plants).where(eq(plants.market, other));
    }
  });
});
