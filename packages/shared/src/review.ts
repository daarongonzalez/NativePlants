import { z } from "zod";

/**
 * The plant review: what the review page is sent, and what it sends back.
 * Shared so the API and the page cannot disagree about the shape.
 */

export interface ReviewPhoto {
  id: string;
  thumbUrl: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  credit: string;
  license: string;
  /** habit | detail, once approved. */
  kind: "habit" | "detail" | null;
  status: "candidate" | "approved" | "rejected";
  note: string | null;
}

export interface ReviewPlant {
  id: string;
  scientificName: string;
  commonNames: string[];
  family: string;
  phMin: number;
  phOptimum: number;
  phMax: number;
  sunMinHours: number;
  sunMaxHours: number;
  waterUse: string;
  drainageTolerated: string[];
  zoneMinOrdinal: number;
  zoneMaxOrdinal: number;
  matureHeightCm: number;
  matureWidthCm: number;
  lifeCycle: string | null;
  plantForm: string | null;
  staysUnder24In: boolean | null;
  bloomStartMonth: number | null;
  bloomEndMonth: number | null;
  nativeStatus: string;
  deerResistant: boolean;
  pollinatorValue: string;
  edible: boolean;
  goodForCutting: boolean;
  toxicityNote: string | null;
  curatedBy: string;
  reviewStatus: "draft" | "reviewed" | "published";
  reviewedBy: string | null;
  reviewedAt: string | null;
  photos: ReviewPhoto[];
  /** The latest decision, and whether the facts have changed since it was made. */
  lastReview: {
    decision: "pass" | "fail";
    notes: string | null;
    spriteCheck: "ok" | "problem" | "none" | null;
    reviewerEmail: string;
    createdAt: string;
    factsChangedSince: boolean;
  } | null;
}

export interface ReviewListResponse {
  reviewer: string;
  market: string;
  plants: ReviewPlant[];
}

export const reviewDecisionSchema = z.object({
  decision: z.enum(["pass", "fail"]),
  notes: z.string().trim().max(4000).nullable().default(null),
  spriteCheck: z.enum(["ok", "problem", "none"]).nullable().default(null),
  photos: z
    .array(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["candidate", "approved", "rejected"]),
        kind: z.enum(["habit", "detail"]).nullable().default(null),
        note: z.string().trim().max(1000).nullable().default(null),
      }),
    )
    .max(50)
    .default([]),
})
  // A fail with no reason leaves nobody able to fix it.
  .refine((d) => d.decision === "pass" || (d.notes !== null && d.notes !== ""), {
    message: "Say what needs to change before failing a plant.",
    path: ["notes"],
  });
export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;
