import type { ElevationClient, ElevationResult } from "./types";
import { SourceShapeError } from "./types";

/**
 * USGS Elevation Point Query Service (3DEP).
 *
 * Needed because nearest-weather-station is not the same as
 * representative-weather-station. On the Wasatch Front a valley-floor station
 * and a bench address can differ by 1,000 ft, which is roughly two weeks at
 * each end of the growing season. Without elevation we cannot tell a gardener
 * that their frost dates are probably later than the number we are showing.
 *
 * Called once on an explicit user action, never on a page load.
 *
 * NOT YET VERIFIED AGAINST A LIVE RESPONSE — egress policy blocks
 * epqs.nationalmap.gov from the build environment.
 */

const ENDPOINT = "https://epqs.nationalmap.gov/v1/json";

/** USGS returns this for points outside its coverage. */
const NO_DATA_SENTINEL = -1000000;

export class UsgsElevationClient implements ElevationClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async elevation(latitude: number, longitude: number): Promise<ElevationResult | null> {
    const url = new URL(ENDPOINT);
    url.searchParams.set("x", String(longitude));
    url.searchParams.set("y", String(latitude));
    url.searchParams.set("units", "Meters");
    url.searchParams.set("wkid", "4326");
    url.searchParams.set("includeDate", "false");

    const response = await this.fetchImpl(url, { headers: { accept: "application/json" } });
    if (!response.ok) {
      throw new SourceShapeError("usgs-epqs", `HTTP ${response.status}`);
    }

    const body = (await response.json()) as Record<string, unknown>;
    const raw = body["value"];

    // The service has historically returned the value as a numeric string.
    const value = typeof raw === "string" ? Number(raw) : raw;
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new SourceShapeError("usgs-epqs", "value is not numeric");
    }

    if (value <= NO_DATA_SENTINEL) return null;

    return { elevationM: value };
  }
}
