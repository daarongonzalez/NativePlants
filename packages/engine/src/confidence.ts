import type { Provenance } from "@np/shared";

/**
 * Confidence rules for a resolved site profile.
 *
 * Pure functions. No I/O. These decide how much to trust a value we just
 * looked up, and they are the difference between a tool that answers and a
 * tool that answers honestly.
 */

/**
 * Above this elevation difference between a site and its weather station, the
 * station's frost dates stop being a good estimate for the site.
 *
 * 150 m is roughly 500 ft. The standard environmental lapse rate is about
 * 6.5 degrees C per 1,000 m, so 150 m is around 1 degree C of difference —
 * enough to move a frost date by about a week on the Wasatch Front, where
 * valley-floor stations serve addresses up to 1,000 ft higher on the benches.
 *
 * Chosen to be defensible rather than precise. Revisit once we have reported
 * frost errors from real gardeners, which is exactly what `profile_reports`
 * exists to collect.
 */
export const FROST_ELEVATION_TOLERANCE_M = 150;

/** Approximate lapse rate, degrees C per metre of elevation gain. */
const LAPSE_RATE_C_PER_M = 0.0065;

export interface FrostConfidence {
  confidence: Provenance["confidence"];
  /** Plain language for the interface. Empty when there is nothing to caveat. */
  note: string;
  elevationDifferenceM: number;
}

function metresToFeet(m: number): number {
  return Math.round(m * 3.28084);
}

/**
 * Decide how much to trust a station's frost dates for a given site.
 *
 * A station HIGHER than the site means the site is warmer, so real frost
 * dates are earlier in spring and later in fall than the station reports —
 * the station is pessimistic. A station LOWER than the site means the
 * opposite, and that is the dangerous direction: a gardener plants on the
 * station's date and loses the planting to a frost that was always coming.
 */
export function frostConfidence(
  siteElevationM: number | null,
  stationElevationM: number | null,
): FrostConfidence {
  // Without both elevations we cannot make the comparison at all. That is
  // itself a reason to lower confidence rather than to claim high.
  if (siteElevationM === null || stationElevationM === null) {
    return {
      confidence: "medium",
      note: "We could not compare your elevation to the weather station's, so treat these dates as approximate.",
      elevationDifferenceM: 0,
    };
  }

  const difference = siteElevationM - stationElevationM;
  const magnitude = Math.abs(difference);

  if (magnitude <= FROST_ELEVATION_TOLERANCE_M) {
    return { confidence: "high", note: "", elevationDifferenceM: difference };
  }

  const feet = metresToFeet(magnitude);
  const shiftC = (magnitude * LAPSE_RATE_C_PER_M).toFixed(1);

  const note =
    difference > 0
      ? `The nearest weather station sits about ${feet} ft below your address, so it runs roughly ${shiftC}°C warmer than your site. Your last spring frost is likely later than the date shown, and your first fall frost earlier.`
      : `The nearest weather station sits about ${feet} ft above your address, so it runs roughly ${shiftC}°C cooler than your site. Your growing season is likely a little longer than the dates shown.`;

  // A large gap in either direction is a medium-confidence claim. We do not
  // drop to "low" because the station data itself is sound 30-year normals —
  // it is the transfer to this address that is uncertain.
  return { confidence: "medium", note, elevationDifferenceM: difference };
}

/**
 * Confidence for a hardiness zone looked up by ZIP.
 *
 * ZIP codes are USPS delivery routes, not geographic areas, and a single ZIP
 * on the Wasatch Front can span 1,500 ft of elevation. A zone from a ZIP is
 * never a high-confidence claim about a specific yard, and saying so is more
 * useful than a false precision competitors are happy to show.
 */
export function zoneConfidence(matchQuality: string): FrostConfidence["confidence"] {
  return matchQuality === "rooftop" ? "medium" : "low";
}
