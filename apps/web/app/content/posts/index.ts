import type { Post } from "../types";
import { howLawnRebatesWork } from "./how-lawn-rebates-work";
import { plantCoverRule } from "./plant-cover-rule";

/**
 * Every guide, newest first. To add one: write a file beside these, then list
 * it here. Planned next, from docs/plan-2026-11.md: the 8 ft lawn rule, drip
 * irrigation that qualifies, low park strip plants, and when to start.
 */
export const POSTS: Post[] = [howLawnRebatesWork, plantCoverRule];

export const postBySlug = (slug: string | undefined) => POSTS.find((p) => p.slug === slug) ?? null;
