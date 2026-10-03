/**
 * External data source clients.
 *
 * Every source is defined as an interface first and an HTTP implementation
 * second. That is not ceremony: it means the resolve pipeline is testable
 * without network access, and it means a source that changes its response
 * shape or goes offline is a swap at one seam rather than a rewrite.
 */

/** How well the geocoder matched. A rooftop hit and a street interpolation are different claims. */
export type MatchQuality = "rooftop" | "interpolated" | "approximate";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  /** Normalized address as the geocoder understood it. Show this back to the user. */
  matchedAddress: string;
  zip: string;
  matchQuality: MatchQuality;
}

export interface GeocodeClient {
  /** Returns null when nothing matched. Throws only on transport failure. */
  geocode(address: string): Promise<GeocodeResult | null>;
}

export interface ElevationResult {
  elevationM: number;
}

export interface ElevationClient {
  /** Returns null when the point is outside coverage. Throws only on transport failure. */
  elevation(latitude: number, longitude: number): Promise<ElevationResult | null>;
}

/** Thrown when a source is reachable but answered in a shape we do not understand. */
export class SourceShapeError extends Error {
  constructor(
    readonly source: string,
    message: string,
  ) {
    super(`${source}: ${message}`);
    this.name = "SourceShapeError";
  }
}
