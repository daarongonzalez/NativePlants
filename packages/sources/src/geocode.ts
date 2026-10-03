import type { GeocodeClient, GeocodeResult, MatchQuality } from "./types";
import { SourceShapeError } from "./types";

/**
 * US Census Bureau geocoder.
 *
 * Chosen over a commercial geocoder for three reasons: it is public domain, it
 * needs no API key, and it shares data lineage with the other federal sources
 * this product reads. US-only, which matches V1 scope exactly.
 *
 * NOT YET VERIFIED AGAINST A LIVE RESPONSE. The parsing below is written to
 * the documented shape; the build environment's egress policy blocks
 * geocoding.geo.census.gov, so the first real call is the first test of these
 * field paths. Run `pnpm --filter @np/sources test` plus one manual call
 * before trusting it in production.
 */

const ENDPOINT = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

/**
 * Census matches are ALWAYS interpolated, never rooftop.
 *
 * The service works by finding the street segment containing the address
 * range and interpolating a position along it — that is what the `tigerLine`
 * and `side` fields in every response describe. It does not hold building
 * footprints, so it cannot produce a rooftop-accurate point, and pretending
 * otherwise would make `matchQuality` a field that always says the same thing
 * while implying it varies.
 *
 * Which leaves `"rooftop"` meaning exactly one thing in this system: a pin the
 * gardener placed themselves. They know which part of the yard they mean, and
 * dragging the pin genuinely earns higher confidence than anything we can
 * derive from a street address.
 */
const CENSUS_MATCH_QUALITY: MatchQuality = "interpolated";

function zipFrom(match: Record<string, unknown>): string | null {
  const components = match["addressComponents"];
  if (!components || typeof components !== "object") return null;
  const zip = (components as Record<string, unknown>)["zip"];
  return typeof zip === "string" && /^\d{5}$/.test(zip) ? zip : null;
}

export class CensusGeocodeClient implements GeocodeClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async geocode(address: string): Promise<GeocodeResult | null> {
    const url = new URL(ENDPOINT);
    url.searchParams.set("address", address);
    url.searchParams.set("benchmark", "Public_AR_Current");
    url.searchParams.set("format", "json");

    const response = await this.fetchImpl(url, {
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      throw new SourceShapeError("census-geocoder", `HTTP ${response.status}`);
    }

    const body = (await response.json()) as Record<string, unknown>;
    const result = body["result"];
    if (!result || typeof result !== "object") {
      throw new SourceShapeError("census-geocoder", "missing result object");
    }

    const matches = (result as Record<string, unknown>)["addressMatches"];
    if (!Array.isArray(matches)) {
      throw new SourceShapeError("census-geocoder", "addressMatches is not an array");
    }

    // No match is a normal outcome for a typo, not an error.
    const first = matches[0] as Record<string, unknown> | undefined;
    if (!first) return null;

    const coordinates = first["coordinates"];
    if (!coordinates || typeof coordinates !== "object") {
      throw new SourceShapeError("census-geocoder", "match has no coordinates");
    }

    const { x, y } = coordinates as { x?: unknown; y?: unknown };
    if (typeof x !== "number" || typeof y !== "number") {
      throw new SourceShapeError("census-geocoder", "coordinates are not numeric");
    }

    const zip = zipFrom(first);
    if (!zip) {
      // Without a ZIP we cannot look up a hardiness zone, so this is a
      // failed geocode from our point of view even though Census answered.
      return null;
    }

    const matchedAddress = first["matchedAddress"];

    return {
      // Census returns x as longitude and y as latitude. Swapping these is the
      // classic silent geospatial bug — it puts Salt Lake City in Antarctica.
      longitude: x,
      latitude: y,
      matchedAddress: typeof matchedAddress === "string" ? matchedAddress : address,
      zip,
      matchQuality: CENSUS_MATCH_QUALITY,
    };
  }
}
