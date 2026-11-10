import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createDatabase, listPlantsForReview, recordPlantReview, type PlantForReview } from "@np/db";
import { reviewDecisionSchema, type ReviewListResponse, type ReviewPlant } from "@np/shared";
import { requireReviewer, type CertFetcher } from "./access";
import type { Env } from "./env";

/**
 * The plant review, for reviewers only. Every route here sits behind
 * requireReviewer (Cloudflare Access, checked again in this Worker).
 */
export function adminRoutes(fetchCerts?: CertFetcher) {
  const routes = new Hono<{ Bindings: Env; Variables: { reviewer: string } }>();
  routes.use("*", requireReviewer(fetchCerts));
  routes.use("*", bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: "That request is too large." }, 413) }));

  // Never cache a reviewer's view: it changes with every decision.
  routes.use("*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });

  routes.get("/plants", async (c) => {
    const db = createDatabase(c.env.HYPERDRIVE.connectionString);
    const rows = await listPlantsForReview(db, c.env.MARKET);
    const body: ReviewListResponse = { reviewer: c.get("reviewer"), market: c.env.MARKET, plants: rows.map(toReviewPlant) };
    return c.json(body);
  });

  routes.post("/plants/:id/review", async (c) => {
    const parsed = reviewDecisionSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "That decision could not be read." }, 400);
    }
    const d = parsed.data;
    const db = createDatabase(c.env.HYPERDRIVE.connectionString);
    const saved = await recordPlantReview(db, {
      plantId: c.req.param("id"),
      market: c.env.MARKET,
      reviewerEmail: c.get("reviewer"),
      decision: d.decision,
      notes: d.notes,
      spriteCheck: d.spriteCheck,
      images: d.photos.map((p) => ({ mediaId: p.id, status: p.status, kind: p.kind, note: p.note })),
    });
    if (!saved) return c.json({ error: "We could not find that plant." }, 404);
    return c.json({ ok: true, reviewStatus: saved.plant.reviewStatus, reviewId: saved.review.id }, 201);
  });

  return routes;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toReviewPlant(p: PlantForReview): ReviewPlant {
  const last = p.reviews[0];
  return {
    id: p.id,
    scientificName: p.scientificName,
    commonNames: p.commonNames,
    family: p.family,
    phMin: p.phMin,
    phOptimum: p.phOptimum,
    phMax: p.phMax,
    sunMinHours: p.sunMinHours,
    sunMaxHours: p.sunMaxHours,
    waterUse: p.waterUse,
    drainageTolerated: p.drainageTolerated,
    zoneMinOrdinal: p.zoneMinOrdinal,
    zoneMaxOrdinal: p.zoneMaxOrdinal,
    matureHeightCm: p.matureHeightCm,
    matureWidthCm: p.matureWidthCm,
    lifeCycle: p.lifeCycle,
    plantForm: p.plantForm,
    staysUnder24In: p.staysUnder24In,
    bloomStartMonth: p.bloomStartMonth,
    bloomEndMonth: p.bloomEndMonth,
    nativeStatus: p.nativeStatus,
    deerResistant: p.deerResistant,
    pollinatorValue: p.pollinatorValue,
    edible: p.edible,
    goodForCutting: p.goodForCutting,
    toxicityNote: p.toxicityNote,
    curatedBy: p.curatedBy,
    reviewStatus: p.reviewStatus as ReviewPlant["reviewStatus"],
    reviewedBy: p.reviewedBy,
    reviewedAt: iso(p.reviewedAt),
    photos: p.media.map((m) => ({
      id: m.id,
      thumbUrl: m.thumbUrl,
      imageUrl: m.remoteUrl,
      sourceUrl: m.sourceUrl,
      credit: m.credit,
      license: m.license,
      kind: (m.kind as "habit" | "detail" | null) ?? null,
      status: m.reviewStatus as "candidate" | "approved" | "rejected",
      note: m.reviewNote,
    })),
    lastReview: last
      ? {
          decision: last.decision as "pass" | "fail",
          notes: last.notes,
          spriteCheck: (last.spriteCheck as "ok" | "problem" | "none" | null) ?? null,
          reviewerEmail: last.reviewerEmail,
          createdAt: last.createdAt.toISOString(),
          factsChangedSince: last.factsHash !== p.factsHash,
        }
      : null,
  };
}
