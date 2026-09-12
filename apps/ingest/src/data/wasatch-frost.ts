import type { FrostRecord } from "../frost";

/**
 * Parsed frost normals for the launch market.
 *
 * **THIS FILE IS A PLACEHOLDER AND MUST BE REPLACED BEFORE LAUNCH.**
 *
 * The real contents come from parsing NOAA NCEI's US Climate Normals
 * freeze/frost probability product for Utah stations, as a one-time offline
 * step. That parse could not be run in the environment this was written in —
 * organization egress policy blocks the NCEI hosts — so this holds a single
 * station with values that are plausible for Salt Lake City International
 * but have NOT been read from the NOAA product.
 *
 * Consequences of shipping this as-is: every Wasatch Front address would
 * resolve to the same frost dates, and those dates would be unsourced. The
 * `data_provenance` row the job writes would cite NOAA for numbers that did
 * not come from NOAA, which is worse than having no data.
 *
 * Replacement checklist:
 *   1. Download the NCEI 1991-2020 freeze/frost probability tables for Utah.
 *   2. Parse to this shape; keep the 10/50/90 columns in that order.
 *   3. Verify against a known station by hand before loading.
 *   4. Delete this notice.
 */
export const WASATCH_FRONT_FROST: readonly FrostRecord[] = [
  {
    stationId: "PLACEHOLDER-KSLC",
    name: "Salt Lake City Intl (PLACEHOLDER - not from NOAA)",
    latitude: 40.7884,
    longitude: -111.9777,
    elevationM: 1288,
    lastSpringP10: "05-08",
    lastSpringP50: "04-24",
    lastSpringP90: "04-09",
    firstFallP10: "10-05",
    firstFallP50: "10-19",
    firstFallP90: "11-02",
    frostFreeDays: 178,
    normalsPeriod: "1991-2020",
  },
];
