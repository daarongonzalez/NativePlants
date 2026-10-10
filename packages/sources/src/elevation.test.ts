import { describe, expect, it } from "vitest";
import { UsgsElevationClient } from "./elevation";
import { SourceShapeError } from "./types";

function respondWith(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

// Captured from the live service on 10 October 2026 (downtown Salt Lake City).
const LIVE_RESPONSE = {
  location: { x: -111.891, y: 40.7608, spatialReference: { wkid: 4326, latestWkid: 4326 } },
  locationId: 0,
  value: "1299.517089844",
  rasterId: 49011,
  resolution: 1,
};

describe("USGS elevation", () => {
  it("parses a response captured from the live service", async () => {
    const client = new UsgsElevationClient(respondWith(LIVE_RESPONSE));
    const result = await client.elevation(40.7608, -111.891);
    expect(result!.elevationM).toBeCloseTo(1299.517, 3);
  });

  it("throws a SourceShapeError when the service answers 200 with plain text", async () => {
    // Captured from the live service for a point in the open Pacific.
    const text = "Call failed.  [Failed cloud operation: Open, Path: /vsimem/_00000236.aux.xml]";
    const fetchImpl = (async () => new Response(text, { status: 200 })) as unknown as typeof fetch;
    const client = new UsgsElevationClient(fetchImpl);
    await expect(client.elevation(0, -150)).rejects.toThrow(SourceShapeError);
    await expect(client.elevation(0, -150)).rejects.toThrow(/not JSON/);
  });

  it("reads a numeric value", async () => {
    const client = new UsgsElevationClient(respondWith({ value: 1320.5 }));
    const result = await client.elevation(40.7608, -111.891);
    expect(result!.elevationM).toBeCloseTo(1320.5, 1);
  });

  it("reads a value returned as a string, which this service has done", async () => {
    const client = new UsgsElevationClient(respondWith({ value: "1320.5" }));
    const result = await client.elevation(40.7608, -111.891);
    expect(result!.elevationM).toBeCloseTo(1320.5, 1);
  });

  it("returns null for the out-of-coverage sentinel instead of a wild number", async () => {
    // Treating -1000000 as an elevation would make every frost comparison
    // absurd and the confidence note actively misleading.
    const client = new UsgsElevationClient(respondWith({ value: -1000000 }));
    expect(await client.elevation(0, 0)).toBeNull();
  });

  it("throws on a non-numeric value", async () => {
    const client = new UsgsElevationClient(respondWith({ value: "not a number" }));
    await expect(client.elevation(40, -111)).rejects.toThrow(SourceShapeError);
  });

  it("throws on an HTTP error", async () => {
    const client = new UsgsElevationClient(respondWith({}, 500));
    await expect(client.elevation(40, -111)).rejects.toThrow(/500/);
  });
});
