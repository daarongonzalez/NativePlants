import { describe, expect, it } from "vitest";
import { CensusGeocodeClient } from "./geocode";
import { SourceShapeError } from "./types";

/**
 * Fixture responses in the shape the Census geocoder returns.
 *
 * MATCH is a response captured from the live service on 10 October 2026 for
 * 451 S State St, Salt Lake City. Fields we do not read are kept so the
 * fixture stays a faithful sample.
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
    input: {
      address: { address: "451 S State St, Salt Lake City, UT 84111" },
      benchmark: { isDefault: true, benchmarkDescription: "Public Address Ranges - Current Benchmark", id: "4", benchmarkName: "Public_AR_Current" },
    },
    addressMatches: [
      {
        tigerLine: { side: "L", tigerLineId: "176067423" },
        coordinates: { x: -111.888147804451, y: 40.759545544294 },
        addressComponents: {
          zip: "84111",
          streetName: "STATE",
          preType: "",
          city: "SALT LAKE CITY",
          preDirection: "S",
          suffixDirection: "",
          fromAddress: "401",
          state: "UT",
          suffixType: "ST",
          toAddress: "499",
          suffixQualifier: "",
          preQualifier: "",
        },
        matchedAddress: "451 S STATE ST, SALT LAKE CITY, UT, 84111",
      },
    ],
  },
};

describe("Census geocoder", () => {
  it("reads coordinates and ZIP from a match", async () => {
    const client = new CensusGeocodeClient(respondWith(MATCH));
    const result = await client.geocode("451 S State St, Salt Lake City, UT 84111");

    expect(result).not.toBeNull();
    expect(result!.zip).toBe("84111");
    expect(result!.matchedAddress).toContain("STATE");
  });

  it("does not swap latitude and longitude", async () => {
    const client = new CensusGeocodeClient(respondWith(MATCH));
    const result = await client.geocode("anywhere");

    // Census returns x as longitude and y as latitude. Swapping puts Salt
    // Lake City in the Southern Ocean, and nothing downstream would notice.
    expect(result!.longitude).toBeCloseTo(-111.888, 3);
    expect(result!.latitude).toBeCloseTo(40.7595, 3);
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
