import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "./client";
import { plantMedia, plantReviews, plants } from "./schema";

/**
 * The plant review: photo candidates in, the reviewer's decisions out.
 *
 * Reference data, not owner-scoped: the routes that call these sit behind
 * the reviewer check in the API (Cloudflare Access), never a visitor route.
 */

/** One photo candidate, as written by scripts/find-plant-images.mjs. */
export interface ImageCandidate {
  source: string;
  photoId: number | string;
  imageUrl: string;
  thumbUrl: string;
  pageUrl: string;
  license: string;
  credit: string;
}

/**
 * Adds photo candidates for the plants in a market. A photo already loaded
 * keeps its review decision; only its links and credit are refreshed.
 * Plants not in the catalogue are skipped and returned, so the load can say so.
 */
export async function loadImageCandidates(
  db: Database,
  market: string,
  byScientificName: Record<string, ImageCandidate[]>,
): Promise<{ written: number; unknownPlants: string[] }> {
  const names = Object.keys(byScientificName);
  if (names.length === 0) return { written: 0, unknownPlants: [] };
  const rows = await db
    .select({ id: plants.id, scientificName: plants.scientificName })
    .from(plants)
    .where(and(eq(plants.market, market), inArray(plants.scientificName, names)));
  const idByName = new Map(rows.map((r) => [r.scientificName, r.id]));

  let written = 0;
  const unknownPlants: string[] = [];
  for (const [name, candidates] of Object.entries(byScientificName)) {
    const plantId = idByName.get(name);
    if (!plantId) {
      if (candidates.length > 0) unknownPlants.push(name);
      continue;
    }
    for (const c of candidates) {
      const links = {
        remoteUrl: c.imageUrl,
        thumbUrl: c.thumbUrl,
        sourceUrl: c.pageUrl,
        credit: c.credit,
        license: c.license,
      };
      await db
        .insert(plantMedia)
        .values({ plantId, source: c.source, sourcePhotoId: String(c.photoId), ...links })
        .onConflictDoUpdate({ target: [plantMedia.plantId, plantMedia.source, plantMedia.sourcePhotoId], set: links });
      written++;
    }
  }
  return { written, unknownPlants };
}

export type PlantForReview = typeof plants.$inferSelect & {
  media: (typeof plantMedia.$inferSelect)[];
  reviews: (typeof plantReviews.$inferSelect)[];
};

/** Every plant in a market with its photos and its review history, newest review first. */
export async function listPlantsForReview(db: Database, market: string): Promise<PlantForReview[]> {
  const rows = await db.select().from(plants).where(eq(plants.market, market)).orderBy(asc(plants.scientificName));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [media, reviews] = await Promise.all([
    db.select().from(plantMedia).where(inArray(plantMedia.plantId, ids)).orderBy(asc(plantMedia.sourcePhotoId)),
    db.select().from(plantReviews).where(inArray(plantReviews.plantId, ids)).orderBy(desc(plantReviews.createdAt)),
  ]);
  return rows.map((p) => ({
    ...p,
    media: media.filter((m) => m.plantId === p.id),
    reviews: reviews.filter((r) => r.plantId === p.id),
  }));
}

export interface ReviewDecision {
  plantId: string;
  market: string;
  reviewerEmail: string;
  decision: "pass" | "fail";
  notes: string | null;
  spriteCheck: "ok" | "problem" | "none" | null;
  images: { mediaId: string; status: "approved" | "rejected" | "candidate"; kind: "habit" | "detail" | null; note: string | null }[];
}

/**
 * Records a decision, all in one transaction:
 * - a row in plant_reviews, against the facts as they stand,
 * - the plant's status: pass publishes it, fail returns it to draft,
 * - each photo's status and use.
 *
 * Returns null if the plant is not in this market.
 */
export async function recordPlantReview(db: Database, d: ReviewDecision) {
  return db.transaction(async (tx) => {
    const [plant] = await tx
      .select({ id: plants.id, factsHash: plants.factsHash })
      .from(plants)
      .where(and(eq(plants.id, d.plantId), eq(plants.market, d.market)));
    if (!plant) return null;

    const now = new Date();
    const [review] = await tx
      .insert(plantReviews)
      .values({
        plantId: plant.id,
        reviewerEmail: d.reviewerEmail,
        decision: d.decision,
        notes: d.notes,
        spriteCheck: d.spriteCheck,
        factsHash: plant.factsHash,
        createdAt: now,
      })
      .returning();

    const [updated] = await tx
      .update(plants)
      .set({
        reviewStatus: d.decision === "pass" ? "published" : "draft",
        reviewedBy: d.reviewerEmail,
        reviewedAt: now,
      })
      .where(eq(plants.id, plant.id))
      .returning({ id: plants.id, reviewStatus: plants.reviewStatus });

    for (const img of d.images) {
      // Scoped to this plant, so a decision can never touch another plant's photos.
      await tx
        .update(plantMedia)
        .set({
          reviewStatus: img.status,
          kind: img.status === "approved" ? img.kind : null,
          reviewNote: img.note,
          reviewedBy: d.reviewerEmail,
          reviewedAt: now,
        })
        .where(and(eq(plantMedia.id, img.mediaId), eq(plantMedia.plantId, plant.id)));
    }

    return { review: review!, plant: updated! };
  });
}
