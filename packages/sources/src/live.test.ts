import { describe, expect, it } from "vitest";
import { CensusGeocodeClient } from "./geocode";
import { UsgsElevationClient } from "./elevation";
import { SoilDataAccessClient } from "./soil";
import { SourceShapeError } from "./types";

/**
 * Live check of the Census geocoder and the USGS elevation service.
 *
 * The other tests in this package run against fixtures written from the
 * services' documentation. This one calls the real services, so it is the only
 * thing that can say whether those field paths are right.
 *
 * Opt-in: it needs internet access and the services can be slow or briefly
 * down, so it must not gate ordinary CI. Run it from the "Live source check"
 * workflow, or locally with:
 *
 *   LIVE_CHECK=1 pnpm --filter @np/sources test live
 *
 * Every raw response is printed on a line starting "RAW " so it can be copied
 * over the fixtures in geocode.test.ts and elevation.test.ts.
 */
const enabled = process.env["LIVE_CHECK"] === "1";
const describeLive = enabled ? describe : describe.skip;

/** Wraps fetch so each raw response body is printed before it is parsed. */
function recording(label: string): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(input, init);
    const body = await response.clone().text();
    console.log(`RAW ${label} HTTP ${response.status} ${body}`);
    return response;
  }) as typeof fetch;
}

// Rough bounding box for the launch market and its buffer.
const inMarket = (lat: number, lon: number) =>
  lat > 39.5 && lat < 41.6 && lon > -112.7 && lon < -110.8;

const ADDRESSES = [
  { label: "SLC City & County Building", address: "451 S State St, Salt Lake City, UT 84111", zip: "84111" },
  { label: "Hogle Zoo, east bench", address: "2600 E Sunnyside Ave, Salt Lake City, UT 84108", zip: "84108" },
  { label: "Ogden City Hall", address: "2549 Washington Blvd, Ogden, UT 84401", zip: "84401" },
];

describeLive("live: Census geocoder", () => {
  for (const a of ADDRESSES) {
    it(`geocodes ${a.label}`, async () => {
      const client = new CensusGeocodeClient(recording(`census:${a.label}`));
      const result = await client.geocode(a.address);

      console.log(`PARSED ${a.label}`, JSON.stringify(result));
      expect(result).not.toBeNull();
      expect(result!.zip).toBe(a.zip);
      // A swapped latitude and longitude would put this far outside Utah.
      expect(inMarket(result!.latitude, result!.longitude)).toBe(true);
      expect(result!.matchQuality).toBe("interpolated");
    }, 30_000);
  }

  it("returns null, not an error, for an address that does not exist", async () => {
    const client = new CensusGeocodeClient(recording("census:nonexistent"));
    const result = await client.geocode("99999 Qwertyuiop Nowhere Blvd, Salt Lake City, UT");
    expect(result).toBeNull();
  }, 30_000);
});

describeLive("live: USGS elevation", () => {
  // Expected ranges are wide on purpose. They catch units (feet instead of
  // metres), swapped coordinates and the no-data sentinel, not survey error.
  const POINTS = [
    { label: "downtown Salt Lake City", lat: 40.7608, lon: -111.891, min: 1250, max: 1350 },
    { label: "Park City, Main Street", lat: 40.6461, lon: -111.498, min: 2000, max: 2200 },
    { label: "Bountiful bench", lat: 40.889, lon: -111.85, min: 1350, max: 1650 },
  ];

  for (const p of POINTS) {
    it(`reads elevation for ${p.label}`, async () => {
      const client = new UsgsElevationClient(recording(`usgs:${p.label}`));
      const result = await client.elevation(p.lat, p.lon);

      console.log(`PARSED ${p.label}`, JSON.stringify(result));
      expect(result).not.toBeNull();
      expect(result!.elevationM).toBeGreaterThan(p.min);
      expect(result!.elevationM).toBeLessThan(p.max);
    }, 30_000);
  }

  it("handles a point outside US coverage without an unexpected error", async () => {
    const client = new UsgsElevationClient(recording("usgs:mid-ocean"));
    // Open Pacific. The service answers HTTP 200 with a plain-text failure
    // here, which our client reports as a SourceShapeError. A clean "no data"
    // (null) would also be acceptable. Anything else, such as a SyntaxError or
    // a made-up elevation, is a bug.
    const outcome = await client.elevation(0, -150).then(
      (r) => r,
      (e: unknown) => e,
    );
    console.log("PARSED mid-ocean", outcome instanceof Error ? `${outcome.name}: ${outcome.message}` : JSON.stringify(outcome));
    expect(outcome === null || outcome instanceof SourceShapeError).toBe(true);
  }, 30_000);
});

describeLive("live: USDA Soil Data Access", () => {
  const client = () => new SoilDataAccessClient(recording("sda"));

  it("finds survey areas for the four launch counties", async () => {
    const areas = await client().findSurveyAreas(["Salt Lake", "Utah County", "Davis", "Weber"]);
    console.log("PARSED survey areas", JSON.stringify(areas));
    expect(areas.length).toBeGreaterThanOrEqual(3);
  }, 60_000);

  it("reads horizons for one survey area, with plausible values", async () => {
    const [area] = await client().findSurveyAreas(["Salt Lake"]);
    expect(area).toBeDefined();

    const soil = await client().fetchSoil(area!.areaSymbol);
    const withHorizons = soil.filter((s) => s.horizons.length > 0);
    console.log("PARSED soil", area!.areaSymbol, `${soil.length} units, ${withHorizons.length} with horizons`, JSON.stringify(withHorizons[0]));
    expect(withHorizons.length).toBeGreaterThan(0);

    // Wasatch Front soils are alkaline. A pH column read from the wrong field
    // would show up as values far outside this range.
    const phs = withHorizons.flatMap((s) => s.horizons.map((h) => h.ph)).filter((p): p is number => p !== null);
    expect(phs.length).toBeGreaterThan(0);
    expect(Math.min(...phs)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...phs)).toBeLessThanOrEqual(11);
    expect(soil.some((s) => s.drainageClass !== null)).toBe(true);
  }, 120_000);

  it("returns valid polygons for a few map units", async () => {
    const [area] = await client().findSurveyAreas(["Salt Lake"]);
    const units = await client().listMapUnits(area!.areaSymbol);
    const geometries = await client().fetchGeometries(units.slice(0, 5).map((u) => u.mukey));
    console.log("PARSED geometry", geometries.map((g) => `${g.mukey} ${g.wkt.slice(0, 80)}`).join(" | "));
    expect(geometries.length).toBeGreaterThan(0);
    for (const g of geometries) expect(g.wkt).toMatch(/^(MULTI)?POLYGON/);
  }, 120_000);
});
