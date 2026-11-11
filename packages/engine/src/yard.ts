/**
 * The yard estimate: measuring a lot from its outline, its buildings and an
 * aerial photo. Pure: no network, no clock, so every number can be tested.
 *
 * Works in metres on UTM zone 12N (EPSG:26912), which covers all of Utah.
 *
 * How it works:
 *  1. The lot comes from the county's parcel outline. Its area is measured
 *     from the outline itself.
 *  2. Each photo pixel inside the lot is sorted into building (inside a
 *     building outline), planted (the infrared band says something is growing)
 *     or bare (paving, gravel, dry ground).
 *  3. The lot edge nearest the street point is the front. Ground between that
 *     edge and the house is the front yard, ground beyond the house is the
 *     back yard, and the rest is side yard.
 *
 * Pixel counts are scaled so they add up to the outline's area exactly.
 */
import { SQFT_PER_M2, type DrawingPoint, type YardZone, type YardZoneKind } from "@np/shared";

export type Point = [number, number];
export type Ring = Point[];

/** Normalised difference vegetation index: above this, a pixel is counted as planted. */
export const PLANTED_NDVI = 0.15;

/* ---- Geometry ---------------------------------------------------------------- */

/** Area of a ring, in the ring's units squared. Closed or open rings both work. */
export function ringArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** Even-odd test: is the point inside the ring? */
export function pointInRing([x, y]: Point, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Inside the outer ring and outside every hole. */
export function pointInPolygon(p: Point, rings: Ring[]): boolean {
  if (rings.length === 0 || !pointInRing(p, rings[0]!)) return false;
  return !rings.slice(1).some((hole) => pointInRing(p, hole));
}

function distanceToSegment([px, py]: Point, [ax, ay]: Point, [bx, by]: Point): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** The edge of the ring closest to a point, as its two ends. */
export function nearestEdge(ring: Ring, p: Point): [Point, Point] {
  let best: [Point, Point] = [ring[0]!, ring[1]!];
  let bestD = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    if (a[0] === b[0] && a[1] === b[1]) continue;
    const d = distanceToSegment(p, a, b);
    if (d < bestD) {
      bestD = d;
      best = [a, b];
    }
  }
  return best;
}

export function distanceToRing(p: Point, ring: Ring): number {
  const [a, b] = nearestEdge(ring, p);
  return pointInRing(p, ring) ? 0 : distanceToSegment(p, a, b);
}

/* ---- WGS84 to UTM zone 12N -------------------------------------------------------- */

/**
 * Latitude and longitude to UTM zone 12N metres (the standard series, good to
 * a few centimetres). Used only to place the street point on the lot's grid.
 */
export function toUtm12(latitude: number, longitude: number): Point {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const lat = (latitude * Math.PI) / 180;
  const lon0 = (-111 * Math.PI) / 180;
  const dLon = (longitude * Math.PI) / 180 - lon0;
  const sin = Math.sin(lat);
  const cos = Math.cos(lat);
  const tan = Math.tan(lat);
  const N = a / Math.sqrt(1 - e2 * sin * sin);
  const T = tan * tan;
  const C = ep2 * cos * cos;
  const A = cos * dLon;
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const M =
    a *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * lat -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * lat) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * lat) -
      ((35 * e6) / 3072) * Math.sin(6 * lat));
  const x =
    k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5) / 120) + 500000;
  const y =
    k0 *
    (M +
      N *
        tan *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6) / 720));
  return [x, y];
}

/* ---- The estimate ------------------------------------------------------------------- */

/** The photo, as an infrared grid over a known box. Row 0 is the top (north) edge. */
export interface NdviGrid {
  columns: number;
  rows: number;
  /** West and north edges of the grid, in UTM metres. */
  left: number;
  top: number;
  metresPerPixel: number;
  /** One value per pixel, row by row, from −1 to 1. NaN where the photo has no data. */
  values: Float32Array | number[];
}

export interface YardInput {
  /** The lot's outline: an outer ring, then any holes. */
  lot: Ring[];
  /** Building outlines near the lot. Only the parts inside the lot count. */
  buildings: Ring[];
  grid: NdviGrid;
  /** Where the address sits, usually on the street in front of the lot. */
  streetPoint: Point;
}

export interface YardMeasure {
  lotSqft: number;
  buildingSqft: number;
  openSqft: number;
  /** Null when the photo could not be read. */
  plantedSqft: number | null;
  bareSqft: number | null;
  zones: YardZone[];
  /** The lot edge taken as the street side, in UTM metres. */
  street: [Point, Point];
  /** The building outlines as used, after lining them up with the photo. */
  buildings: Ring[];
  cells: { columns: number; rows: number; codes: string };
}

type Code = "p" | "b" | "u" | "h" | ".";
const sqft = (m2: number) => Math.round(m2 * SQFT_PER_M2);
const feet = (m: number) => Math.round(m * 3.28084);

/** How far, in pixels, building outlines may be nudged to line up with the photo. */
export const MAX_ALIGN_PIXELS = 6;

/**
 * Building outlines (from 2018 imagery) often sit a few feet off the roofs in
 * a newer photo, which would count a ring of roof as bare yard. This finds
 * the nudge, up to MAX_ALIGN_PIXELS each way, that puts the outlines over
 * the least growing ground: roofs do not grow. Returns the shift in metres.
 */
export function alignBuildings(buildings: Ring[], grid: NdviGrid): Point {
  const { columns, rows, left, top, metresPerPixel: px, values } = grid;
  if (buildings.length === 0) return [0, 0];
  const covered: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const p: Point = [left + (c + 0.5) * px, top - (r + 0.5) * px];
      if (buildings.some((b) => pointInRing(p, b))) covered.push(r * columns + c);
    }
  }
  const score = (dx: number, dy: number) => {
    let s = 0;
    let n = 0;
    for (const i of covered) {
      const r = Math.floor(i / columns) + dy;
      const c = (i % columns) + dx;
      if (r < 0 || r >= rows || c < 0 || c >= columns) continue;
      const v = Number(values[r * columns + c]);
      if (!Number.isFinite(v)) continue;
      n++;
      if (v > PLANTED_NDVI) s++;
    }
    return n === 0 ? Infinity : s / n;
  };
  const base = score(0, 0);
  if (!Number.isFinite(base)) return [0, 0];
  let best: [number, number, number] = [0, 0, base];
  for (let dy = -MAX_ALIGN_PIXELS; dy <= MAX_ALIGN_PIXELS; dy++) {
    for (let dx = -MAX_ALIGN_PIXELS; dx <= MAX_ALIGN_PIXELS; dx++) {
      const s = score(dx, dy);
      // Prefer the smaller nudge when two are about as good.
      const better = s < best[2] - 0.02 || (Math.abs(s - best[2]) <= 0.02 && Math.hypot(dx, dy) < Math.hypot(best[0], best[1]) && s <= best[2]);
      if (better) best = [dx, dy, s];
    }
  }
  // Only move when it clearly helps: noise should not shift a good outline.
  if (base - best[2] < 0.05) return [0, 0];
  return [best[0] * px, -best[1] * px];
}

export function measureYard({ lot, buildings: given, grid, streetPoint }: YardInput): YardMeasure {
  const outer = lot[0]!;
  // Each building is lined up on its own: outlines are traced separately and drift differently.
  const buildings = given.map((b) => {
    const [sx, sy] = alignBuildings([b], grid);
    return b.map(([x, y]): Point => [x + sx, y + sy]);
  });
  const lotM2 = ringArea(outer) - lot.slice(1).reduce((s, h) => s + ringArea(h), 0);

  // The front edge, and a unit normal pointing from it into the lot.
  const street = nearestEdge(outer, streetPoint);
  const [ea, eb] = street;
  const ex = eb[0] - ea[0];
  const ey = eb[1] - ea[1];
  const elen = Math.hypot(ex, ey) || 1;
  const tx = ex / elen;
  const ty = ey / elen;
  let nx = -ty;
  let ny = tx;
  const centroid = outer.reduce<Point>((c, p) => [c[0] + p[0] / outer.length, c[1] + p[1] / outer.length], [0, 0]);
  if ((centroid[0] - ea[0]) * nx + (centroid[1] - ea[1]) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const along = (p: Point) => (p[0] - ea[0]) * tx + (p[1] - ea[1]) * ty;
  const away = (p: Point) => (p[0] - ea[0]) * nx + (p[1] - ea[1]) * ny;

  // Sort every pixel inside the lot.
  const { columns, rows, left, top, metresPerPixel: px, values } = grid;
  const codes: Code[] = new Array(columns * rows).fill(".");
  const centres: (Point | null)[] = new Array(columns * rows).fill(null);
  const owner: number[] = new Array(columns * rows).fill(-1);
  const perBuilding = new Array<number>(buildings.length).fill(0);
  let inLot = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const p: Point = [left + (c + 0.5) * px, top - (r + 0.5) * px];
      if (!pointInPolygon(p, lot)) continue;
      const i = r * columns + c;
      inLot++;
      centres[i] = p;
      const b = buildings.findIndex((ring) => pointInRing(p, ring));
      if (b >= 0) {
        codes[i] = "h";
        owner[i] = b;
        perBuilding[b]!++;
      } else {
        const v = Number(values[i]);
        codes[i] = !Number.isFinite(v) ? "u" : v > PLANTED_NDVI ? "p" : "b";
      }
    }
  }

  // The house is the biggest building inside the lot. Garages, sheds and a
  // neighbour's eaves over the line count as built-on, but do not move where
  // the front and back yards start.
  const house = perBuilding.reduce((best, n, i) => (n > (perBuilding[best] ?? 0) ? i : best), 0);
  let houseNear = Infinity;
  let houseFar = -Infinity;
  for (let i = 0; i < codes.length; i++) {
    if (owner[i] !== house || (perBuilding[house] ?? 0) === 0) continue;
    const d = away(centres[i]!);
    houseNear = Math.min(houseNear, d);
    houseFar = Math.max(houseFar, d);
  }

  // Scale pixel counts so they add up to the outline's area.
  const perPixelM2 = inLot > 0 ? lotM2 / inLot : 0;
  const hasHouse = Number.isFinite(houseNear);

  const zoneOf = (p: Point): YardZoneKind => {
    if (!hasHouse) return "front";
    const d = away(p);
    if (d < houseNear) return "front";
    if (d > houseFar) return "back";
    return "side";
  };

  const tally = new Map<YardZoneKind, { planted: number; bare: number; unknown: number; a0: number; a1: number; d0: number; d1: number }>();
  let building = 0;
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]!;
    const p = centres[i];
    if (code === "." || !p) continue;
    if (code === "h") {
      building++;
      continue;
    }
    const kind = zoneOf(p);
    const t = tally.get(kind) ?? { planted: 0, bare: 0, unknown: 0, a0: Infinity, a1: -Infinity, d0: Infinity, d1: -Infinity };
    if (code === "p") t.planted++;
    else if (code === "b") t.bare++;
    else t.unknown++;
    const a = along(p);
    const d = away(p);
    t.a0 = Math.min(t.a0, a - px / 2);
    t.a1 = Math.max(t.a1, a + px / 2);
    t.d0 = Math.min(t.d0, d - px / 2);
    t.d1 = Math.max(t.d1, d + px / 2);
    tally.set(kind, t);
  }

  const order: YardZoneKind[] = ["front", "back", "side"];
  const zones: YardZone[] = order
    .filter((k) => tally.has(k))
    .map((kind) => {
      const t = tally.get(kind)!;
      // Without a photo reading, planted and bare are unknown, not zero.
      const read = t.unknown === 0;
      const planted = sqft(t.planted * perPixelM2);
      const bare = sqft(t.bare * perPixelM2);
      return {
        kind,
        // The sum of the rounded parts, so the figures people see always add up.
        areaSqft: read ? planted + bare : sqft((t.planted + t.bare + t.unknown) * perPixelM2),
        plantedSqft: read ? planted : null,
        bareSqft: read ? bare : null,
        widthFt: feet(t.a1 - t.a0),
        depthFt: feet(t.d1 - t.d0),
      };
    })
    // A sliver of a few pixels is noise along an edge, not a yard.
    .filter((z) => z.areaSqft >= 50);

  const read = zones.every((z) => z.plantedSqft !== null);
  return {
    lotSqft: sqft(lotM2),
    buildingSqft: sqft(building * perPixelM2),
    openSqft: zones.reduce((s, z) => s + z.areaSqft, 0),
    plantedSqft: read ? zones.reduce((s, z) => s + (z.plantedSqft ?? 0), 0) : null,
    bareSqft: read ? zones.reduce((s, z) => s + (z.bareSqft ?? 0), 0) : null,
    zones,
    street,
    buildings,
    cells: { columns, rows, codes: codes.join("") },
  };
}

/**
 * A grid with no photo reading, for when the photo service does not answer:
 * the lot and its yards can still be measured from the outlines alone.
 */
export function blankGrid(box: [number, number, number, number], metresPerPixel: number): NdviGrid {
  const [x0, y0, x1, y1] = box;
  const columns = Math.max(1, Math.round((x1 - x0) / metresPerPixel));
  const rows = Math.max(1, Math.round((y1 - y0) / metresPerPixel));
  return { columns, rows, left: x0, top: y1, metresPerPixel: (x1 - x0) / columns, values: new Float32Array(columns * rows).fill(Number.NaN) };
}

/** UTM metres to drawing metres: from the grid's top-left, y down. */
export function toDrawing(grid: Pick<NdviGrid, "left" | "top">, [x, y]: Point): DrawingPoint {
  return [Math.round((x - grid.left) * 100) / 100, Math.round((grid.top - y) * 100) / 100];
}

/** NDVI from 8-bit near-infrared and red values. */
export function ndvi(nir: number, red: number): number {
  const sum = nir + red;
  return sum === 0 ? Number.NaN : (nir - red) / sum;
}
