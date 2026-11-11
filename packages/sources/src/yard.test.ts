import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodePng } from "./png";
import { UtahYardSources, addressKey, chooseLot, naipImageUrl, type LotRecord } from "./yard";

/**
 * Recorded responses from the real services (November 2026) for one Salt
 * Lake City block. House addresses were replaced with made-up ones before
 * saving; the shapes are as the services sent them.
 */
const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url));

/** A fetch that answers from the fixtures by service, and records what was asked. */
function recordedFetch(overrides: Partial<Record<"parcels" | "buildings" | "infrared" | "date", () => Response>> = {}) {
  const asked: URL[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    asked.push(url);
    const path = url.pathname;
    if (path.includes("Parcels_")) {
      if (overrides.parcels) return overrides.parcels();
      // Only Salt Lake County has lots here; the other counties answer empty.
      const body = path.includes("SaltLake") ? fixture("ugrc-parcels.json") : JSON.stringify({ features: [] });
      return new Response(body, { headers: { "Content-Type": "application/json" } });
    }
    if (path.includes("Buildings")) return overrides.buildings?.() ?? new Response(fixture("ugrc-buildings.json"));
    if (path.endsWith("exportImage")) return overrides.infrared?.() ?? new Response(fixture("naip-infrared.png"));
    if (path.endsWith("/query")) {
      return overrides.date?.() ?? Response.json({ features: [{ attributes: { acquisition_date: Date.UTC(2021, 10, 13) } }] });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { impl, asked };
}

describe("UtahYardSources", () => {
  it("finds lots near a point in metres, and only asks for the fields it uses", async () => {
    const { impl, asked } = recordedFetch();
    const lots = await new UtahYardSources(impl).lotsNear(40.73986, -111.84492);
    expect(lots).toHaveLength(8);
    expect(lots.find((l) => l.address === "100 S EXAMPLE ST")).toMatchObject({
      county: "Salt Lake County",
      propertyClass: "Residential",
      buildingSqft: 1382,
      floors: 1,
      builtYear: 1951,
    });
    // Coordinates are UTM metres, not degrees.
    expect(lots[0]!.rings[0]![0]![0]).toBeGreaterThan(400_000);
    const fields = asked[0]!.searchParams.get("outFields")!;
    expect(fields).not.toMatch(/VALUE|OWNER/);
    expect(asked[0]!.searchParams.get("resultRecordCount")).toBeNull();
    expect(asked.filter((u) => u.pathname.includes("Parcels_"))).toHaveLength(4);
  });

  it("keeps going when one county's service fails, but not when all do", async () => {
    let n = 0;
    const flaky = recordedFetch({ parcels: () => (n++ === 0 ? new Response("down", { status: 502 }) : Response.json({ features: [] })) });
    await expect(new UtahYardSources(flaky.impl).lotsNear(40.7, -111.8)).resolves.toEqual([]);
    const down = recordedFetch({ parcels: () => new Response("down", { status: 502 }) });
    await expect(new UtahYardSources(down.impl).lotsNear(40.7, -111.8)).rejects.toThrow("every county parcel service failed");
  });

  it("reads the photo's infrared as plant growth, pixel for pixel", async () => {
    const expected = JSON.parse(fixture("naip-infrared.json").toString()) as { width: number; height: number; first: number[][] };
    const box: [number, number, number, number] = [428604.46, 4510194.21, 428604.46 + 81 * 0.6, 4510194.21 + 51 * 0.6];
    const grid = await new UtahYardSources(recordedFetch().impl).infrared(box, 0.6);
    expect(grid).toMatchObject({ columns: expected.width, rows: expected.height, left: box[0], top: box[3] });
    const [nir, red] = expected.first[0]!;
    expect(grid.values[0]).toBeCloseTo((nir! - red!) / (nir! + red!), 5);
    // The same bytes, read by our reader and by Pillow when the fixture was saved.
    const png = await decodePng(fixture("naip-infrared.png"));
    expect(Array.from(png.data.slice(0, 15))).toEqual(expected.first.slice(0, 5).flat());
  });

  it("retries the photo once after a gateway timeout", async () => {
    let calls = 0;
    const { impl } = recordedFetch({
      infrared: () => (calls++ === 0 ? new Response("gateway timeout", { status: 504 }) : new Response(fixture("naip-infrared.png"))),
    });
    const grid = await new UtahYardSources(impl).infrared([428604.46, 4510194.21, 428604.46 + 48.6, 4510194.21 + 30.6], 0.6);
    expect(calls).toBe(2);
    expect(grid.columns).toBe(81);
  });

  it("refuses a photo of the wrong size rather than misreading it", async () => {
    const { impl } = recordedFetch();
    await expect(new UtahYardSources(impl).infrared([0, 0, 60, 60], 0.6)).rejects.toThrow(/asked for 100×100/);
  });

  it("reads when the photo was taken", async () => {
    await expect(new UtahYardSources(recordedFetch().impl).photoDate(40.7, -111.8)).resolves.toBe("2021-11-13");
  });

  it("builds a natural-colour photo link people can open", () => {
    const url = naipImageUrl([1, 2, 3, 4], 10, 20);
    expect(url.searchParams.get("bandIds")).toBe("0,1,2");
    expect(url.searchParams.get("size")).toBe("10,20");
    expect(url.searchParams.get("bboxSR")).toBe("26912");
  });
});

describe("choosing the lot", () => {
  const lot = (address: string | null, x: number, size = 10): LotRecord => ({
    rings: [
      [
        [x, 0],
        [x + size, 0],
        [x + size, size],
        [x, size],
        [x, 0],
      ],
    ],
    county: "Salt Lake County",
    address,
    acres: null,
    propertyClass: "Residential",
    houseCount: 1,
    buildingSqft: null,
    floors: null,
    builtYear: null,
    recordsAsOf: null,
  });

  it("compares addresses without directions, street types or punctuation", () => {
    expect(addressKey("1373 S GLENMARE ST, SALT LAKE CITY, UT, 84105")).toBe("1373 GLENMARE");
    expect(addressKey("1373 South Glenmare Street")).toBe("1373 GLENMARE");
    expect(addressKey("1373 E 1700 S")).toBe("1373 1700");
    expect(addressKey("PO Box 9")).toBeNull();
  });

  it("prefers the lot whose address matches, over a nearer one", () => {
    const lots = [lot("100 S OTHER ST", 0), lot("200 S EXAMPLE ST", 100)];
    expect(chooseLot(lots, [5, -10], "200 S Example Street, Salt Lake City, UT")).toMatchObject({
      matchedBy: "address",
      lot: { address: "200 S EXAMPLE ST" },
    });
  });

  it("takes the biggest when several parcels share an address", () => {
    const lots = [lot("200 S EXAMPLE ST", 0, 3), lot("200 S EXAMPLE ST", 50, 20)];
    expect(chooseLot(lots, [0, 0], "200 S EXAMPLE ST")?.lot.rings[0]![0]).toEqual([50, 0]);
  });

  it("falls back to the nearest lot, and says so", () => {
    const lots = [lot("1 A ST", 0), lot("2 B ST", 30)];
    expect(chooseLot(lots, [33, -4], "999 Nowhere Rd")).toMatchObject({ matchedBy: "nearest", lot: { address: "2 B ST" } });
    expect(chooseLot([], [0, 0], null)).toBeNull();
  });
});
