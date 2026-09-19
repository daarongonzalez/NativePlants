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

describe("USGS elevation", () => {
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
