/**
 * Sun hours, from solar geometry. Pure, no I/O.
 *
 * Two different claims live here and they must never be confused:
 *
 *  - `openSkySunHours` is MODELLED. It is how long the sun is above the horizon
 *    on the longest day of the year at a latitude, assuming nothing shades the
 *    spot. It knows nothing about the neighbour's oak, the house wall, or the
 *    mountains east of the Wasatch Front benches. It is an upper bound on what
 *    any spot at that latitude can receive.
 *  - `sunHoursFromExposure` is REPORTED by the gardener, who can see the spot.
 *    It is a better answer whenever we have it.
 */

const SUMMER_SOLSTICE_DECLINATION_DEG = 23.44;

/** The sun's upper edge at the horizon, including atmospheric refraction. */
const SUNRISE_ALTITUDE_DEG = -0.833;

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Hours of daylight on the summer solstice at a latitude, rounded to 0.1.
 *
 * Standard sunrise equation. In the polar day and polar night cases the
 * argument of acos leaves [-1, 1]; it is clamped, giving 24 and 0.
 */
export function openSkySunHours(latitudeDeg: number): number {
  // The "summer" solstice is June in the north and December in the south.
  const declination = rad(latitudeDeg >= 0 ? SUMMER_SOLSTICE_DECLINATION_DEG : -SUMMER_SOLSTICE_DECLINATION_DEG);
  const phi = rad(latitudeDeg);

  const cosHourAngle =
    (Math.sin(rad(SUNRISE_ALTITUDE_DEG)) - Math.sin(phi) * Math.sin(declination)) /
    (Math.cos(phi) * Math.cos(declination));

  const hourAngle = Math.acos(Math.max(-1, Math.min(1, cosHourAngle)));
  return Math.round(((2 * hourAngle * 12) / Math.PI) * 10) / 10;
}

export type SunExposure = "full" | "part" | "shade";

/**
 * The usual garden definitions, turned into one representative number so the
 * scoring engine can treat reported and modelled sun the same way:
 *
 *  - full sun: 6 or more hours of direct sun
 *  - part sun: 3 to 6 hours
 *  - shade: under 3 hours
 *
 * Each value sits inside its band rather than on an edge. Open for review by
 * the horticultural reviewer.
 */
export const SUN_EXPOSURE_HOURS: Readonly<Record<SunExposure, number>> = {
  full: 8,
  part: 4.5,
  shade: 2,
};

export const SUN_EXPOSURE_LABELS: Readonly<Record<SunExposure, string>> = {
  full: "full sun (6 or more hours)",
  part: "part sun (3 to 6 hours)",
  shade: "shade (under 3 hours)",
};

export function sunHoursFromExposure(exposure: SunExposure): number {
  return SUN_EXPOSURE_HOURS[exposure];
}
