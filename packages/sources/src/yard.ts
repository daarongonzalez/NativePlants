/**
 * Sources for the yard estimate. All three are free, public and need no key:
 *
 *  - Lots: county parcel outlines and tax-roll details, published by the Utah
 *    Geospatial Resource Center (UGRC) for each county.
 *  - Buildings: UGRC's building outlines, derived from Microsoft's open
 *    building footprints (ODbL).
 *  - The photo: the USDA National Agriculture Imagery Program (NAIP), served
 *    by the US Geological Survey. It has a near-infrared band, which shows
 *    growing plants clearly, at 60 cm a pixel.
 *
 * Everything comes back in metres on UTM zone 12N (EPSG:26912), which covers
 * all of Utah.
 *
 * Only the fields the estimate uses are requested. County records also hold
 * values and owner-related fields; this code never asks for them.
 */
import { decodePng } from "./png";
import { SourceShapeError } from "./types";

const UGRC = "https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services";
const NAIP = "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer";
export const UTM12 = 26912;

/** Wrapped so the Workers runtime keeps fetch's own `this` (see geocode.ts). */
const defaultFetch: typeof fetch = (...args) => fetch(...args);

/** The counties we serve, by their UGRC service name. */
export const WASATCH_PARCEL_SERVICES = ["Parcels_SaltLake_LIR", "Parcels_Utah_LIR", "Parcels_Davis_LIR", "Parcels_Weber_LIR"] as const;

const LOT_FIELDS = [
  "COUNTY_NAME",
  "PARCEL_ADD",
  "PARCEL_ACRES",
  "PROP_CLASS",
  "HOUSE_CNT",
  "BLDG_SQFT",
  "FLOORS_CNT",
  "BUILT_YR",
  "CURRENT_ASOF",
];

export type UtmPoint = [number, number];
export type UtmRing = UtmPoint[];

export interface LotRecord {
  /** Outer ring first, then any holes. */
  rings: UtmRing[];
  county: string;
  address: string | null;
  acres: number | null;
  propertyClass: string | null;
  houseCount: number | null;
  buildingSqft: number | null;
  floors: number | null;
  builtYear: number | null;
  recordsAsOf: string | null;
}

export interface InfraredGrid {
  columns: number;
  rows: number;
  left: number;
  top: number;
  metresPerPixel: number;
  /** NDVI per pixel, row by row. */
  values: Float32Array;
}

async function getJson(fetchImpl: typeof fetch, source: string, url: URL, timeoutMs = 8_000): Promise<Record<string, unknown>> {
  const res = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new SourceShapeError(source, `HTTP ${res.status}`);
  const body = (await res.json()) as Record<string, unknown>;
  // ArcGIS reports errors with a 200 and an `error` object.
  if (body["error"]) throw new SourceShapeError(source, JSON.stringify(body["error"]).slice(0, 200));
  return body;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

function ringsOf(feature: unknown): UtmRing[] {
  const geometry = (feature as { geometry?: { rings?: unknown } })?.geometry;
  const rings = geometry?.rings;
  if (!Array.isArray(rings)) return [];
  return rings.filter((r): r is UtmRing => Array.isArray(r) && r.length >= 4);
}

/* ---- Matching an address to a lot ------------------------------------------------- */

const IGNORED = new Set(["N", "S", "E", "W", "NORTH", "SOUTH", "EAST", "WEST", "ST", "STREET", "AVE", "AVENUE", "RD", "ROAD", "DR", "DRIVE", "LN", "LANE", "CT", "COURT", "CIR", "CIRCLE", "WAY", "PL", "PLACE", "BLVD", "PKWY", "TER", "HWY", "UNIT", "APT"]);

/**
 * House number and street name, ignoring directions and street types, so
 * "1373 S GLENMARE ST, SALT LAKE CITY, UT, 84105" and "1373 S Glenmare Street"
 * compare equal. Utah grid streets keep their numbers: "1373 E 1700 S" → 1373 / 1700.
 */
export function addressKey(address: string | null): string | null {
  if (!address) return null;
  const first = address.split(",")[0]!.toUpperCase().replace(/[^A-Z0-9 ]/g, " ");
  const [number, ...rest] = first.split(/\s+/).filter(Boolean);
  if (!number || !/^\d+$/.test(number)) return null;
  const street = rest.filter((t) => !IGNORED.has(t));
  return street.length ? `${number} ${street.join(" ")}` : null;
}

function distanceToRing([px, py]: UtmPoint, ring: UtmRing): number {
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, ay] = ring[i]!;
    const [bx, by] = ring[i + 1]!;
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

function ringSize(ring: UtmRing): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) sum += ring[i]![0] * ring[i + 1]![1] - ring[i + 1]![0] * ring[i]![1];
  return Math.abs(sum) / 2;
}

/**
 * Picks the lot: the one whose address matches, or failing that the nearest.
 * The Census geocoder usually places an address on the street, not in the
 * lot, so "the lot under the point" is often the road or nobody's.
 */
export function chooseLot(
  lots: LotRecord[],
  point: UtmPoint,
  address: string | null,
): { lot: LotRecord; matchedBy: "address" | "nearest" } | null {
  const usable = lots.filter((l) => l.rings.length > 0);
  if (usable.length === 0) return null;
  const key = addressKey(address);
  // Several parcels can share an address (a lot and a strip beside it): take the biggest.
  const byAddress = key
    ? usable.filter((l) => addressKey(l.address) === key).sort((a, b) => ringSize(b.rings[0]!) - ringSize(a.rings[0]!))[0]
    : undefined;
  if (byAddress) return { lot: byAddress, matchedBy: "address" };
  const nearest = usable
    .map((l) => ({ l, d: distanceToRing(point, l.rings[0]!) }))
    .sort((a, b) => a.d - b.d)[0]!;
  return { lot: nearest.l, matchedBy: "nearest" };
}

/* ---- Clients ------------------------------------------------------------------------------- */

export class UtahYardSources {
  constructor(private readonly fetchImpl: typeof fetch = defaultFetch) {}

  /**
   * Lots within `radiusM` metres of a point, from every county we serve,
   * asked in parallel. A county that fails is skipped, not fatal.
   */
  async lotsNear(latitude: number, longitude: number, radiusM = 40): Promise<LotRecord[]> {
    const results = await Promise.allSettled(
      WASATCH_PARCEL_SERVICES.map(async (service) => {
        const url = new URL(`${UGRC}/${service}/FeatureServer/0/query`);
        url.searchParams.set("geometry", `${longitude},${latitude}`);
        url.searchParams.set("geometryType", "esriGeometryPoint");
        url.searchParams.set("inSR", "4326");
        url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
        url.searchParams.set("distance", String(radiusM));
        url.searchParams.set("units", "esriSRUnit_Meter");
        url.searchParams.set("outFields", LOT_FIELDS.join(","));
        url.searchParams.set("returnGeometry", "true");
        url.searchParams.set("outSR", String(UTM12));
        // No resultRecordCount: it makes these services several times slower,
        // and a 40 m search only ever finds a handful of lots.
        url.searchParams.set("f", "json");
        const body = await getJson(this.fetchImpl, `ugrc-${service}`, url);
        const features = body["features"];
        if (!Array.isArray(features)) throw new SourceShapeError(`ugrc-${service}`, "features is not an array");
        return features.map((f): LotRecord => {
          const a = ((f as { attributes?: Record<string, unknown> }).attributes ?? {}) as Record<string, unknown>;
          const asOf = num(a["CURRENT_ASOF"]);
          return {
            rings: ringsOf(f),
            county: str(a["COUNTY_NAME"]) ?? service.replace("Parcels_", "").replace("_LIR", ""),
            address: str(a["PARCEL_ADD"]),
            acres: num(a["PARCEL_ACRES"]),
            propertyClass: str(a["PROP_CLASS"]),
            houseCount: num(a["HOUSE_CNT"]),
            buildingSqft: num(a["BLDG_SQFT"]),
            floors: num(a["FLOORS_CNT"]),
            builtYear: num(a["BUILT_YR"]),
            recordsAsOf: asOf ? new Date(asOf).toISOString().slice(0, 10) : null,
          };
        });
      }),
    );
    const lots = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    if (lots.length === 0 && results.every((r) => r.status === "rejected")) {
      throw new SourceShapeError("ugrc-parcels", "every county parcel service failed");
    }
    return lots;
  }

  /** Building outlines touching a box, in UTM metres. */
  async buildingsIn([x0, y0, x1, y1]: [number, number, number, number]): Promise<UtmRing[]> {
    const url = new URL(`${UGRC}/Buildings/FeatureServer/0/query`);
    url.searchParams.set("geometry", `${x0},${y0},${x1},${y1}`);
    url.searchParams.set("geometryType", "esriGeometryEnvelope");
    url.searchParams.set("inSR", String(UTM12));
    url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
    url.searchParams.set("outFields", "OBJECTID");
    url.searchParams.set("returnGeometry", "true");
    url.searchParams.set("outSR", String(UTM12));
    url.searchParams.set("f", "json");
    const body = await getJson(this.fetchImpl, "ugrc-buildings", url);
    const features = body["features"];
    if (!Array.isArray(features)) throw new SourceShapeError("ugrc-buildings", "features is not an array");
    return features.flatMap((f) => ringsOf(f).slice(0, 1));
  }

  /**
   * The photo's infrared reading over a box, as NDVI per pixel. Asks for the
   * near-infrared, red and green bands as one PNG and works out NDVI here.
   */
  async infrared(box: [number, number, number, number], metresPerPixel = 0.6): Promise<InfraredGrid> {
    const [x0, y0, x1, y1] = box;
    const columns = Math.max(1, Math.round((x1 - x0) / metresPerPixel));
    const rows = Math.max(1, Math.round((y1 - y0) / metresPerPixel));
    const url = naipImageUrl(box, columns, rows, "3,0,1");
    // The photo service sometimes answers a gateway timeout and then recovers
    // within seconds, so one quick retry is worth it.
    let res: Response | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        res = await this.fetchImpl(url, { signal: AbortSignal.timeout(attempt === 1 ? 6_000 : 4_000) });
        if (res.ok || res.status < 500) break;
      } catch (error) {
        if (attempt === 2) throw new SourceShapeError("usgs-naip", `no answer: ${String(error)}`);
      }
    }
    if (!res || !res.ok) throw new SourceShapeError("usgs-naip", `HTTP ${res?.status ?? "none"}`);
    const png = await decodePng(await res.arrayBuffer()).catch((e: unknown) => {
      throw new SourceShapeError("usgs-naip", `image could not be read: ${String(e)}`);
    });
    if (png.width !== columns || png.height !== rows) {
      throw new SourceShapeError("usgs-naip", `asked for ${columns}×${rows}, got ${png.width}×${png.height}`);
    }
    const values = new Float32Array(columns * rows);
    for (let i = 0; i < values.length; i++) {
      const nir = png.data[i * png.channels]!;
      const red = png.data[i * png.channels + 1]!;
      values[i] = nir + red === 0 ? Number.NaN : (nir - red) / (nir + red);
    }
    return { columns, rows, left: x0, top: y1, metresPerPixel: (x1 - x0) / columns, values };
  }

  /** When the photo at a point was taken, as YYYY-MM-DD, or null if the service does not say. */
  async photoDate(latitude: number, longitude: number): Promise<string | null> {
    const url = new URL(`${NAIP}/query`);
    url.searchParams.set("geometry", JSON.stringify({ x: longitude, y: latitude, spatialReference: { wkid: 4326 } }));
    url.searchParams.set("geometryType", "esriGeometryPoint");
    url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
    url.searchParams.set("where", "Category = 1");
    url.searchParams.set("outFields", "acquisition_date");
    url.searchParams.set("returnGeometry", "false");
    url.searchParams.set("f", "json");
    const body = await getJson(this.fetchImpl, "usgs-naip", url, 3_000);
    const dates = (Array.isArray(body["features"]) ? body["features"] : [])
      .map((f) => num((f as { attributes?: Record<string, unknown> }).attributes?.["acquisition_date"]))
      .filter((d): d is number => d !== null);
    if (dates.length === 0) return null;
    return new Date(Math.max(...dates)).toISOString().slice(0, 10);
  }
}

/**
 * The photo service's image link for a box. Bands "0,1,2" give natural
 * colour (for people to look at); "3,0,1" put infrared first (for measuring).
 */
export function naipImageUrl([x0, y0, x1, y1]: [number, number, number, number], columns: number, rows: number, bands = "0,1,2"): URL {
  const url = new URL(`${NAIP}/exportImage`);
  url.searchParams.set("bbox", `${x0},${y0},${x1},${y1}`);
  url.searchParams.set("bboxSR", String(UTM12));
  url.searchParams.set("imageSR", String(UTM12));
  url.searchParams.set("size", `${columns},${rows}`);
  url.searchParams.set("format", "png");
  url.searchParams.set("bandIds", bands);
  url.searchParams.set("renderingRule", JSON.stringify({ rasterFunction: "None" }));
  url.searchParams.set("interpolation", "RSP_NearestNeighbor");
  url.searchParams.set("f", "image");
  return url;
}
