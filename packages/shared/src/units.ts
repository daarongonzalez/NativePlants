/**
 * Units are explicit in every name. A silent unit mismatch between a soil
 * survey (metric) and a US gardener's mental model (imperial) is the most
 * likely source of a wrong answer in this system.
 */

/** Soil pH, 1:1 water suspension. Wasatch Front soils run near 8.0. */
export type Ph = number;

/** Percentage of the mineral fraction by weight. sand + silt + clay = 100. */
export type Percent = number;

/** Depth below the soil surface, centimetres. SSURGO horizons are metric. */
export type DepthCm = number;

/** Hours of direct sun on the summer solstice. */
export type SunHours = number;

/** Mature dimension, centimetres. Stored metric, displayed imperial. */
export type SizeCm = number;

/** USDA hardiness zone as a sortable integer: 8a = 81, 8b = 82, 7a = 71. */
export type ZoneOrdinal = number;

const ZONE_PATTERN = /^(\d{1,2})([ab])$/i;

/** "8b" -> 82. Returns null for anything unparseable rather than guessing. */
export function zoneToOrdinal(zone: string): ZoneOrdinal | null {
  const match = ZONE_PATTERN.exec(zone.trim());
  if (!match) return null;
  const [, numberPart, letterPart] = match;
  if (numberPart === undefined || letterPart === undefined) return null;
  const band = Number(numberPart);
  if (band < 1 || band > 13) return null;
  return band * 10 + (letterPart.toLowerCase() === "a" ? 1 : 2);
}

/** 82 -> "8b". */
export function ordinalToZone(ordinal: ZoneOrdinal): string {
  const band = Math.floor(ordinal / 10);
  return `${band}${ordinal % 10 === 1 ? "a" : "b"}`;
}
