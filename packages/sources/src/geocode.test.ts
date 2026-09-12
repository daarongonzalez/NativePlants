import { describe, expect, it } from "vitest";
import { CensusGeocodeClient } from "./geocode";
import { SourceShapeError } from "./types";

/**
 * Fixture responses written to the Census geocoder's documented shape.
 *
 * These have NOT been captured from a live call — the build environment's
 * egress policy blocks geocoding.geo.census.gov. They pin our parsing against
 * the documented contract, which catches regressions but would not catch the
 * documentation being wrong. Replace them with captured responses on the first
 * run against the real service.
 */
function respondWith(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

const MATCH = {
  result: {
    addressMatches: [
      {
        matchedAddress: "1745 E SUNNYSIDE AVE, SALT LAKE CITY, UT, 84108",
        coordinates: { x: -111.839, y: 40.7503 },
        tigerLine: { tigerLineId: "12345678", side: "L" },
        addressComponents: {
          fromAddress: "1701",
          toAddress: "1799",
          streetName: "SUNNYSIDE",
          city: "SALT LAKE CITY",
          state: "UT",
          zip: "84108",
        },
      },
    ],
  },
};

describe("Census geocoder", () => {
  it("reads coordinates and ZIP from a match", async () => {
    const client = new CensusGeocodeClient(respondWith(MATCH));
    const result = await client.geocode("1745 E Sunnyside Ave, Salt Lake City, UT");

    expect(result).not.toBeNull();
    expect(result!.zip).toBe("84108");
    expect(result!.matchedAddress).toContain("SUNNYSIDE");
  });

  it("does not swap latitude and longitude", async () => {
    const client = new CensusGeocodeClient(respondWith(MATCH));
    const result = await client.geocode("anywhere");

    // Census returns x as longitude and y as latitude. Swapping puts Salt
    // Lake City in the Southern Ocean, and nothing downstream would notice.
    expect(result!.longitude).toBeCloseTo(-111.839, 3);
    expect(result!.latitude).toBeCloseTo(40.7503, 3);
    expect(result!.latitude).toBeGreaterThan(0);
    expect(result!.longitude).toBeLessThan(0);
  });

  it("reports interpolated quality, because Census cannot do better", async () => {
    const client = new CensusGeocodeClient(respondWith(MATCH));
    const result = await client.geocode("anywhere");
    expect(result!.matchQuality).toBe("interpolated");
  });

  it("returns null for no match rather than throwing", async () => {
    const client = new CensusGeocodeClient(respondWith({ result: { addressMatches: [] } }));
    expect(await client.geocode("not a real address at all")).toBeNull();
  });

  it("returns null when a match carries no ZIP, since we cannot look up a zone", async () => {
    const noZip = {
      result: {
        addressMatches: [
          { matchedAddress: "X", coordinates: { x: -111, y: 40 }, addressComponents: {} },
        ],
      },
    };
    const client = new CensusGeocodeClient(respondWith(noZip));
    expect(await client.geocode("somewhere")).toBeNull();
  });

  it("throws on a malformed envelope rather than guessing", async () => {
    const client = new CensusGeocodeClient(respondWith({ unexpected: true }));
    await expect(client.geocode("x")).rejects.toThrow(SourceShapeError);
  });

  it("throws on non-numeric coordinates", async () => {
    const bad = {
      result: {
        addressMatches: [
          {
            matchedAddress: "X",
            coordinates: { x: "-111.8", y: "40.7" },
            addressComponents: { zip: "84108" },
          },
        ],
      },
    };
    const client = new CensusGeocodeClient(respondWith(bad));
    await expect(client.geocode("x")).rejects.toThrow(SourceShapeError);
  });

  it("throws on an HTTP error", async () => {
    const client = new CensusGeocodeClient(respondWith({}, 503));
    await expect(client.geocode("x")).rejects.toThrow(/503/);
  });
});
