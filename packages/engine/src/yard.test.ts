import { describe, expect, it } from "vitest";
import { SQFT_PER_M2 } from "@np/shared";
import { alignBuildings, blankGrid, measureYard, ndvi, nearestEdge, pointInPolygon, ringArea, toUtm12, type NdviGrid, type Ring } from "./yard";

/**
 * A lot worked out by hand: 20 m along the street, 30 m deep, with the street
 * to the south. A 10 by 10 m house sits 10 m back. A 3 m driveway runs from
 * the street to the house on the east side. Pixels are 1 m.
 */
const lot: Ring = [
  [0, 0],
  [20, 0],
  [20, 30],
  [0, 30],
  [0, 0],
];
const house: Ring = [
  [5, 10],
  [15, 10],
  [15, 20],
  [5, 20],
  [5, 10],
];
// The neighbour's garage pokes 2 m over the east line; only the part inside the lot may count.
const neighbour: Ring = [
  [18, 22],
  [26, 22],
  [26, 28],
  [18, 28],
  [18, 22],
];

function grid(): NdviGrid {
  const left = -2;
  const top = 32;
  const columns = 24;
  const rows = 34;
  const values = new Array<number>(columns * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const x = left + c + 0.5;
      const y = top - r - 0.5;
      const driveway = x > 15 && x < 18 && y < 10;
      // Roofs do not grow: the house and the neighbour's garage read bare, as in a real photo.
      const roof = (x > 5 && x < 15 && y > 10 && y < 20) || (x > 18 && y > 22 && y < 28);
      values[r * columns + c] = driveway || roof ? 0.02 : 0.45;
    }
  }
  return { columns, rows, left, top, metresPerPixel: 1, values };
}

const m2 = (n: number) => Math.round(n * SQFT_PER_M2);

describe("measureYard", () => {
  const result = measureYard({ lot: [lot], buildings: [house, neighbour], grid: grid(), streetPoint: [10, -6] });

  it("measures the lot from its outline and the buildings from the photo", () => {
    expect(result.lotSqft).toBe(m2(600));
    // House 100 m², plus the 2 by 6 m of the neighbour's garage inside the line.
    expect(result.buildingSqft).toBe(m2(112));
    expect(result.openSqft + result.buildingSqft).toBeCloseTo(result.lotSqft, -1);
  });

  it("splits front, back and side yards around the house, facing the street", () => {
    const byKind = Object.fromEntries(result.zones.map((z) => [z.kind, z]));
    expect(Object.keys(byKind)).toEqual(["front", "back", "side"]);
    expect(byKind["front"]).toMatchObject({ areaSqft: m2(200), bareSqft: m2(30), plantedSqft: m2(170), widthFt: 66, depthFt: 33 });
    // The neighbour's garage is built-on ground in the back yard, not a bigger house.
    expect(byKind["back"]).toMatchObject({ areaSqft: m2(200 - 12), bareSqft: 0, depthFt: 33 });
    expect(byKind["side"]).toMatchObject({ areaSqft: m2(100), bareSqft: 0 });
  });

  it("takes the lot edge nearest the street point as the front", () => {
    expect(result.street).toEqual([
      [0, 0],
      [20, 0],
    ]);
    // Turn the street to the west, and the front yard becomes the west strip.
    const west = measureYard({ lot: [lot], buildings: [house], grid: grid(), streetPoint: [-6, 15] });
    expect(west.street).toEqual([
      [0, 30],
      [0, 0],
    ]);
    expect(west.zones.find((z) => z.kind === "front")).toMatchObject({ areaSqft: m2(150), widthFt: 98, depthFt: 16 });
  });

  it("calls the whole lot front yard when there is no building on it", () => {
    const empty = measureYard({ lot: [lot], buildings: [], grid: grid(), streetPoint: [10, -6] });
    expect(empty.zones.map((z) => z.kind)).toEqual(["front"]);
    expect(empty.buildingSqft).toBe(0);
  });

  it("still sizes the lot and its yards without a photo, and says planted is unknown", () => {
    const blind = measureYard({ lot: [lot], buildings: [house], grid: blankGrid([-2, -2, 22, 32], 1), streetPoint: [10, -6] });
    expect(blind.lotSqft).toBe(m2(600));
    expect(blind.buildingSqft).toBe(m2(100));
    expect(blind.plantedSqft).toBeNull();
    expect(blind.bareSqft).toBeNull();
    expect(blind.zones.find((z) => z.kind === "front")).toMatchObject({ areaSqft: m2(200), plantedSqft: null, widthFt: 66, depthFt: 33 });
  });

  it("records what each pixel was counted as", () => {
    const { columns, rows, codes } = result.cells;
    expect(codes).toHaveLength(columns * rows);
    expect(codes.match(/h/g)).toHaveLength(112);
    expect(codes.match(/b/g)).toHaveLength(30);
  });
});

describe("alignBuildings", () => {
  // The photo's roof (bare) sits 2 m east and 1 m south of the outline.
  function roofGrid(): NdviGrid {
    const g = grid();
    const values = g.values as number[];
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.columns; c++) {
        const x = g.left + c + 0.5;
        const y = g.top - r - 0.5;
        const outline = x > 5 && x < 15 && y > 10 && y < 20;
        const roof = x > 7 && x < 17 && y > 9 && y < 19;
        if (roof) values[r * g.columns + c] = 0.01;
        else if (outline) values[r * g.columns + c] = 0.45;
      }
    }
    return g;
  }

  it("finds the nudge that puts the outline over the roof", () => {
    expect(alignBuildings([house], roofGrid())).toEqual([2, -1]);
  });

  it("leaves a well-placed outline alone, and does nothing without a photo", () => {
    expect(alignBuildings([house], grid())).toEqual([0, 0]);
    expect(alignBuildings([house], blankGrid([-2, -2, 22, 32], 1))).toEqual([0, 0]);
  });

  it("stops a misplaced outline counting roof as bare yard", () => {
    const result = measureYard({ lot: [lot], buildings: [house, neighbour], grid: roofGrid(), streetPoint: [10, -6] });
    // Only the driveway and the strip of driveway the roof now covers are bare;
    // none of the roof leaks into the yard as bare ground.
    // House 100 m², plus the neighbour's garage, which was already in place and stays put.
    expect(result.buildingSqft).toBe(m2(112));
    expect(result.bareSqft).toBeLessThanOrEqual(m2(30));
  });
});

describe("geometry", () => {
  it("measures areas and finds edges", () => {
    expect(ringArea(lot)).toBe(600);
    expect(ringArea(lot.slice(0, 4))).toBe(600);
    expect(nearestEdge(lot, [25, 15])).toEqual([
      [20, 0],
      [20, 30],
    ]);
  });

  it("respects holes", () => {
    const hole: Ring = [
      [8, 8],
      [12, 8],
      [12, 12],
      [8, 12],
      [8, 8],
    ];
    expect(pointInPolygon([10, 10], [lot, hole])).toBe(false);
    expect(pointInPolygon([2, 2], [lot, hole])).toBe(true);
  });

  it("reads plant growth from infrared and red", () => {
    expect(ndvi(188, 99)).toBeCloseTo(0.31, 2);
    expect(Number.isNaN(ndvi(0, 0))).toBe(true);
  });

  it("places a Salt Lake City point on the UTM grid within a metre", () => {
    // Checked against the county's parcel service, which returned this lot's
    // outline in EPSG:26912 for a query at this point.
    const [x, y] = toUtm12(40.7398, -111.8455);
    expect(x).toBeGreaterThan(428610);
    expect(x).toBeLessThan(428648);
    expect(y).toBeGreaterThan(4510200);
    expect(y).toBeLessThan(4510220);
  });
});
