import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UtahYardSources } from "@np/sources";
import app from "./index";
import { estimateYard } from "./yard";

/**
 * The whole estimate, run on responses recorded from the real services for
 * one Salt Lake City block (addresses replaced with made-up ones).
 */
const fixture = (name: string) => readFileSync(new URL(`../../../packages/sources/src/__fixtures__/${name}`, import.meta.url));

function recorded({ photo = true } = {}) {
  return new UtahYardSources((async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.includes("Parcels_")) {
      return new Response(url.pathname.includes("SaltLake") ? fixture("ugrc-parcels.json") : JSON.stringify({ features: [] }));
    }
    if (url.pathname.includes("Buildings")) return new Response(fixture("ugrc-buildings.json"));
    if (url.pathname.endsWith("exportImage")) {
      if (!photo) return new Response("gateway timeout", { status: 504 });
      // The recorded photo covers this lot plus a 6 m margin, at 0.6 m a pixel.
      return new Response(fixture("naip-infrared.png"));
    }
    return Response.json({ features: [{ attributes: { acquisition_date: Date.UTC(2021, 10, 13) } }] });
  }) as typeof fetch);
}

// On the street in front of the lot, where the Census geocoder puts an address.
const place = { latitude: 40.73986, longitude: -111.84492, address: "100 S Example St, Salt Lake City, UT, 84105" };

describe("estimateYard", () => {
  it("measures the lot, the house and the planted ground", async () => {
    const outcome = await estimateYard(recorded(), place);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const e = outcome.estimate;
    expect(e.parcel).toMatchObject({ county: "Salt Lake County", matchedBy: "address", recordedBuildingSqft: 1382, builtYear: 1951 });
    // The county records 0.17 acres (7,405 sq ft, rounded); the outline measures a little less.
    expect(e.parcel.lotSqft).toBeGreaterThan(7000);
    expect(e.parcel.lotSqft).toBeLessThan(7405);
    expect(e.photo.read).toBe(true);
    expect(e.plantedSqft! + e.bareSqft!).toBe(e.openSqft);
    expect(e.openSqft + e.buildingSqft).toBeGreaterThan(e.parcel.lotSqft - 30);
    expect(e.zones.map((z) => z.kind)).toContain("front");
    expect(e.photo.url).toContain("exportImage");
    expect(e.drawing.cells.codes).toHaveLength(e.drawing.cells.columns * e.drawing.cells.rows);
  });

  it("warns when the photo was taken outside the growing season", async () => {
    const outcome = await estimateYard(recorded(), place);
    expect(outcome.ok && outcome.estimate.caveats.some((c) => c.includes("November 2021"))).toBe(true);
  });

  it("still sizes the yard when the photo service is down, and says so", async () => {
    const outcome = await estimateYard(recorded({ photo: false }), place);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.estimate.photo.read).toBe(false);
    expect(outcome.estimate.plantedSqft).toBeNull();
    expect(outcome.estimate.zones[0]!.areaSqft).toBeGreaterThan(0);
    expect(outcome.estimate.caveats[0]).toMatch(/could not read the aerial photo/);
  });

  it("says when there is no lot to estimate", async () => {
    const empty = new UtahYardSources((async () => Response.json({ features: [] })) as typeof fetch);
    await expect(estimateYard(empty, place)).resolves.toEqual({ ok: false, reason: "no_lot" });
  });
});

describe("the yard route", () => {
  const env = { HYPERDRIVE: { connectionString: "postgres://unused" }, MARKET: "wasatch-front" };
  const post = (body: unknown) =>
    app.request("/v1/public/yard", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }, env);

  it("is open to visitors, and refuses a point outside Utah before calling anything", async () => {
    expect((await post({ latitude: 34.05, longitude: -118.24 })).status).toBe(400);
    expect((await post({ latitude: "x" })).status).toBe(400);
  });
});
