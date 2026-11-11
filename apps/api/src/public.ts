import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import {
  createDatabase,
  getPlannerPlants,
  getRebateProgram,
  listPlannerPlants,
  listRebateAreas,
  recordRebateCheck,
} from "@np/db";
import { checkPlan } from "@np/engine";
import { ordinalToZone, planLayoutSchema, sunExposureSchema } from "@np/shared";
import { CensusGeocodeClient, UsgsElevationClient, UtahYardSources } from "@np/sources";
import type { Env, Variables } from "./env";
import { assembleProfile } from "./resolve";
import { estimateYard } from "./yard";

/**
 * Routes for visitors who have not signed in.
 *
 * The first answer comes with no sign-up wall, so these read reference data
 * and write nothing personal. The one write is the rebate tracker, which
 * stores the plan shape, the result and at most a ZIP code: never an address,
 * an email or a user.
 */
export const publicRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Plans are small. Anything bigger than this is not a plan.
publicRoutes.use("*", bodyLimit({ maxSize: 32 * 1024, onError: (c) => c.json({ error: "That request is too large." }, 413) }));

const lookupSchema = z.object({ address: z.string().trim().min(5).max(300) });

/** Address in, the geocoder's best match out. Nothing is saved. */
publicRoutes.post("/lookup", async (c) => {
  const body = lookupSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Enter a street address, city and state." }, 400);

  const match = await new CensusGeocodeClient().geocode(body.data.address);
  if (!match) {
    return c.json({ error: "We could not find that address. Check the spelling, and include the city and state." }, 422);
  }
  return c.json({ match });
});

const profileSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  zip: z.string().regex(/^\d{5}$/),
  matchQuality: z.enum(["rooftop", "interpolated", "approximate"]).default("approximate"),
  sunExposure: sunExposureSchema.optional(),
});

/** The site profile for a point, built fresh and not saved. */
publicRoutes.post("/profile", async (c) => {
  const body = profileSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "We need a location to build your profile." }, 400);
  const { sunExposure, ...place } = body.data;

  const db = createDatabase(c.env.HYPERDRIVE.connectionString);
  const outcome = await assembleProfile(
    { db, elevation: new UsgsElevationClient() },
    place,
    sunExposure ? { sunExposure } : {},
  );
  if (!outcome.ok) {
    return c.json(
      { error: "We do not have data for that area yet. Right now we cover the Wasatch Front: Salt Lake, Utah, Davis and Weber counties." },
      422,
    );
  }

  return c.json({
    zone: ordinalToZone(outcome.values.zoneOrdinal),
    values: outcome.values,
    provenance: outcome.provenance,
    caveats: outcome.caveats,
    detail: outcome.detail,
  });
});

/**
 * Plants offered in the planner. Drafts are included while the reviewer works
 * through the sheet (PLANNER_PLANTS = "drafts"); the planner labels them.
 */
const includeDrafts = (env: Env) => env.PLANNER_PLANTS === "drafts";

/** A program, its current rules, its communities and the planner's plants. */
publicRoutes.get("/rebates/:code", async (c) => {
  const db = createDatabase(c.env.HYPERDRIVE.connectionString);
  const code = c.req.param("code");
  const program = await getRebateProgram(db, code);
  if (!program) return c.json({ error: "We do not have that rebate program." }, 404);

  const [areas, plants] = await Promise.all([
    listRebateAreas(db, code),
    listPlannerPlants(db, c.env.MARKET, { includeDrafts: includeDrafts(c.env) }),
  ]);
  return c.json({ program, areas, plants });
});

const checkSchema = z.object({
  projectId: z.string().uuid().nullable().default(null),
  zip: z.string().regex(/^\d{5}$/).nullable().default(null),
  layout: planLayoutSchema,
});

/**
 * "Check my plan". The check runs again here rather than trusting the
 * browser's answer, against plants and rules read from the database, and the
 * result is recorded for the tracker.
 */
publicRoutes.post("/rebates/:code/checks", async (c) => {
  const body = checkSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "That plan could not be read.", details: body.error.issues }, 400);

  const db = createDatabase(c.env.HYPERDRIVE.connectionString);
  const code = c.req.param("code");
  const program = await getRebateProgram(db, code);
  if (!program) return c.json({ error: "We do not have that rebate program." }, 404);

  const { layout } = body.data;
  const ids = [...new Set(layout.cells.flatMap((cell) => (cell.kind === "plant" ? [cell.plantId] : [])))];
  const plants = await getPlannerPlants(db, c.env.MARKET, ids, { includeDrafts: includeDrafts(c.env) });

  const check = checkPlan(program, layout, plants);
  const saved = await recordRebateCheck(db, {
    programCode: code,
    projectId: body.data.projectId,
    zip: body.data.zip,
    layout,
    check,
  });

  return c.json({ projectId: saved?.projectId ?? null, checkId: saved?.checkId ?? null, check }, 201);
});

const yardSchema = z.object({
  latitude: z.number().min(36.9).max(42.1),
  longitude: z.number().min(-114.1).max(-109),
  /** The matched address, to pick the right lot when several are near the point. */
  address: z.string().trim().max(300).nullable().default(null),
});

/**
 * The yard estimate for a point: the lot, its buildings, and how much of the
 * open ground is planted or bare, from county records and an aerial photo.
 * Nothing is saved. Answers are cached briefly at the edge, keyed by the
 * request, so the report and the planner do not ask the sources twice.
 */
publicRoutes.post("/yard", async (c) => {
  const body = yardSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "We need a location in Utah to estimate your yard." }, 400);
  const place = {
    latitude: Math.round(body.data.latitude * 1e6) / 1e6,
    longitude: Math.round(body.data.longitude * 1e6) / 1e6,
    address: body.data.address,
  };

  const cacheKey = new Request(
    `https://cache.internal/yard?lat=${place.latitude}&lon=${place.longitude}&a=${encodeURIComponent(place.address ?? "")}`,
  );
  const cache = typeof caches !== "undefined" ? (caches as unknown as { default?: Cache }).default : undefined;
  const hit = await cache?.match(cacheKey).catch(() => undefined);
  if (hit) return new Response(hit.body, hit);

  let outcome;
  try {
    outcome = await estimateYard(new UtahYardSources(), place);
  } catch (error) {
    console.error("yard estimate failed", error);
    return c.json({ error: "We could not reach the county records just now. Your plan still works: enter your sizes by hand." }, 503);
  }
  if (!outcome.ok) {
    const message =
      outcome.reason === "lot_too_large"
        ? "This lot is too large to estimate. Plan one area at a time and enter its size by hand."
        : "We could not find a lot at this address in the county records. You can still enter your sizes by hand.";
    return c.json({ error: message }, 422);
  }

  const res = c.json({ estimate: outcome.estimate });
  res.headers.set("Cache-Control", "public, max-age=3600");
  // Only cache a full answer: one without the photo should be retried next time.
  if (cache && outcome.estimate.photo.read) c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()).catch(() => undefined));
  return res;
});
