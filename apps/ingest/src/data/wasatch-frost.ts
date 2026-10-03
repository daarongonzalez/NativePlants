import type { FrostRecord } from "../frost";

/**
 * Frost normals for the launch market.
 *
 * GENERATED - do not edit by hand. Regenerate with:
 *
 *   node scripts/parse-noaa-frost.mjs <ncei-csv-dir> > apps/ingest/src/data/wasatch-frost.ts
 *
 * Source: NOAA NCEI U.S. Annual/Seasonal Climate Normals, 1991-2020, the
 * 32F freeze probability variables (ANN-TMIN-PRBLST/PRBFST/PRBGSL-T32F).
 * https://www.ncei.noaa.gov/data/normals-annualseasonal/1991-2020/access/
 *
 * Public domain, US Government work.
 */
export const WASATCH_FRONT_FROST: readonly FrostRecord[] = [
  {
    stationId: "USW00024127",
    name: "SALT LAKE CITY INTERNATIONAL AIRPORT, UT US",
    latitude: 40.7781,
    longitude: -111.9694,
    elevationM: 1287.8,
    lastSpringP10: "05-09",
    lastSpringP50: "04-21",
    lastSpringP90: "03-31",
    firstFallP10: "10-09",
    firstFallP50: "10-24",
    firstFallP90: "11-06",
    frostFreeDays: 187,
    normalsPeriod: "1991-2020",
  },
];
