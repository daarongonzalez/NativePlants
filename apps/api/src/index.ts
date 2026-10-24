import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { createDatabase, getFrostNorms, listPublishedPlants, type Owner } from "@np/db";
import {
  createSite,
  deleteSite,
  getConstraints,
  getLatestProfile,
  getSite,
  listSavedPlants,
  listSites,
  savePlant,
} from "@np/db";
import { recommend } from "@np/engine";
import { goalsSchema, siteProfileSchema } from "@np/shared";
import { CensusGeocodeClient, UsgsElevationClient } from "@np/sources";
import { requireAuth } from "./auth";
import type { Env, Variables } from "./env";
import { toDomainProfile } from "./profile";
import { resolveSite } from "./resolve";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", cors({ origin: ["http://localhost:5173"], credentials: true }));

app.get("/v1/health", (c) => c.json({ ok: true, market: c.env.MARKET }));

const protectedRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
protectedRoutes.use("*", requireAuth);

const createSiteSchema = z.object({
  label: z.string().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  addressText: z.string().max(300).optional(),
});

protectedRoutes.get("/sites", async (c) => {
  const db = createDatabase(c.env.HYPERDRIVE.connectionString);
  return c.json({ sites: await listSites(db, c.get("owner")) });
});

protectedRoutes.post("/sites", async (c) => {
  const parsed = createSiteSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Check the address and try again.", details: parsed.error.issues }, 400);
  }

  const db = createDatabase(c.env.HYPERDRIVE.connectionString);
  const site = await createSite(db, c.get("owner"), parsed.data);
  if (!site) return c.json({ error: "Could not save that location." }, 500);

  return c.json({ site }, 201);
});

protectedRoutes.get("/sites/:id", async (c) => {
  const db = createDatabase(c.env.HYPERDRIVE.connectionString);
  const owner: Owner = c.get("owner");
  const siteId = c.req.param("id");

  const site = await getSite(db, owner, siteId);
  if (!site) return c.json({ error: "Site not found." }, 404);

  const [profile, constraints] = await Promise.all([
    getLatestProfile(db, owner, siteId),
    getConstraints(db, owner, siteId),
  ]);

  return c.json({ site, profile, constraints });
});

protectedRoutes.delete("/sites/:id", async (c) => {
  const db = createDatabase(c.env.HYPERDRIVE.connectionString);
  const removed = await deleteSite(db, c.get("owner"), c.req.param("id"));
  if (!removed) return c.json({ error: "Site not found." }, 404);
  return c.body(null, 204);
});

protectedRoutes.get("/sites/:id/plants", async (c) => {
  const db = createDatabase(c.env.HYPERDRIVE.connectionString);
  const owner: Owner = c.get("owner");
  const siteId = c.req.param("id");

  const site = await getSite(db, owner, siteId);
  if (!site) return c.json({ error: "Site not found." }, 404);

  const stored = await getLatestProfile(db, owner, siteId);
  if (!stored) {
    return c.json({ error: "This site has no profile yet. Resolve it first." }, 409);
  }

  const goals = goalsSchema.parse({
    pollinators: c.req.query("pollinators") === "true",
    lowWater: c.req.query("lowWater") === "true",
    deerResistant: c.req.query("deerResistant") === "true",
    cutFlowers: c.req.query("cutFlowers") === "true",
    edible: c.req.query("edible") === "true",
  });

  // The engine takes a fully-typed profile and nothing else. Parsing here
  // rather than trusting the row keeps the engine's contract honest.
  // Frost bands are reference data keyed by the station the profile recorded.
  const norms = stored.frostStationId ? await getFrostNorms(db, stored.frostStationId) : null;
  const frost = norms
    ? {
        lastSpringP10: norms.lastSpringP10,
        lastSpringP50: norms.lastSpringP50,
        lastSpringP90: norms.lastSpringP90,
        firstFallP10: norms.firstFallP10,
        firstFallP50: norms.firstFallP50,
        firstFallP90: norms.firstFallP90,
        frostFreeDays: norms.frostFreeDays,
      }
    : null;

  const domain = toDomainProfile({ ...stored, frost }, site, siteId);
  if ("missing" in domain) {
    return c.json(
      {
        error: "This site's profile is not complete enough to recommend plants yet.",
        missing: domain.missing,
      },
      409,
    );
  }
  const profile = siteProfileSchema.parse(domain.profile);
  const catalogue = await listPublishedPlants(db, c.env.MARKET);
  const { recommended, rejected } = recommend(profile, catalogue, goals);

  return c.json({
    recommended: recommended.map((r) => ({
      plant: r.plant,
      score: r.score,
      headline: r.headline,
      reasons: r.components.filter((x) => x.explanation !== ""),
    })),
    // "We considered 140 and ruled out 96 because your soil is alkaline" is
    // more trustworthy than a bare list, and it teaches people their ground.
    consideredCount: recommended.length + rejected.length,
    ruledOutCount: rejected.length,
  });
});

/**
 * Build a profile snapshot for a site.
 *
 * Always writes a new snapshot rather than updating one, so a recommendation
 * stays reproducible against the profile it was generated from.
 */
protectedRoutes.post("/sites/:id/resolve", async (c) => {
  const db = createDatabase(c.env.HYPERDRIVE.connectionString);
  const owner: Owner = c.get("owner");
  const siteId = c.req.param("id");

  const site = await getSite(db, owner, siteId);
  if (!site) return c.json({ error: "Site not found." }, 404);

  // Optional body: how sunny the gardener says the spot is. An empty body is fine.
  const body = z
    .object({ sunExposure: z.enum(["full", "part", "shade"]).optional() })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Sun exposure must be full, part or shade." }, 400);

  const outcome = await resolveSite(
    { db, geocoder: new CensusGeocodeClient(), elevation: new UsgsElevationClient() },
    owner,
    { id: site.id, addressText: site.addressText, latitude: site.latitude, longitude: site.longitude },
    body.data.sunExposure ? { sunExposure: body.data.sunExposure } : {},
  );

  if (!outcome.ok) {
    switch (outcome.reason) {
      case "site_not_found":
        return c.json({ error: "Site not found." }, 404);
      case "address_not_found":
        return c.json(
          { error: "We could not find that address. Check it, or drop a pin on the map instead." },
          422,
        );
      case "zone_unavailable":
        return c.json(
          { error: "We do not have hardiness zone data for that area yet. Right now we cover the Wasatch Front." },
          422,
        );
    }
  }

  return c.json({ profileId: outcome.profileId, summary: outcome.summary }, 201);
});

protectedRoutes.post("/sites/:id/saved", async (c) => {
  const body = z.object({ plantId: z.string().uuid() }).safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Which plant?" }, 400);

  const db = createDatabase(c.env.HYPERDRIVE.connectionString);
  const ok = await savePlant(db, c.get("owner"), c.req.param("id"), body.data.plantId);
  if (!ok) return c.json({ error: "Site not found." }, 404);

  return c.body(null, 204);
});

protectedRoutes.get("/sites/:id/saved", async (c) => {
  const db = createDatabase(c.env.HYPERDRIVE.connectionString);
  const plants = await listSavedPlants(db, c.get("owner"), c.req.param("id"));
  return c.json({ plants });
});

app.route("/v1", protectedRoutes);

app.onError((err, c) => {
  console.error("unhandled", err);
  return c.json({ error: "Something went wrong on our end." }, 500);
});

app.notFound((c) => c.json({ error: "Not found." }, 404));

export default app;
