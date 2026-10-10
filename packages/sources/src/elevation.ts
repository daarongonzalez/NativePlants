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
 * Checked against live responses on 10 October 2026: the value comes back as
 * a numeric string, and a point outside coverage can come back as plain text
 * rather than JSON (see below).
 */

const ENDPOINT = "https://epqs.nationalmap.gov/v1/json";

/** Wrapped, not bare — see the note in geocode.ts on Illegal invocation. */
const defaultFetch: typeof fetch = (...args) => fetch(...args);

/** USGS returns this for points outside its coverage. */
const NO_DATA_SENTINEL = -1000000;

export class UsgsElevationClient implements ElevationClient {
  constructor(private readonly fetchImpl: typeof fetch = defaultFetch) {}

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

    // The service answers HTTP 200 with a plain-text body for some failures,
    // e.g. "Call failed. [Failed cloud operation: Open, Path: ...]" for a
    // point in the open ocean. That is not JSON, so say what happened rather
    // than surfacing a bare SyntaxError.
    const text = await response.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new SourceShapeError("usgs-epqs", `response is not JSON: ${text.slice(0, 120)}`);
    }
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
