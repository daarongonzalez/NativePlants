/**
 * Pure helpers for choosing which ZIPs and weather stations belong to the
 * launch market. No network and no file access here, so each one can be tested
 * against a small fixture.
 */

/** Salt Lake, Utah, Davis and Weber counties (state 49). */
export const MARKET_COUNTY_FIPS = ["49035", "49049", "49011", "49057"];

/**
 * Bounding box for candidate weather stations.
 *
 * Deliberately wider than the four counties: an address near a county line can
 * be closest to a station across it, and Heber (Wasatch County) already sits in
 * our verification set. The frost parser drops stations without complete 32F
 * normals, so a generous box costs nothing.
 */
export const MARKET_STATION_BOX = {
  minLat: 39.7,
  maxLat: 41.5,
  minLon: -112.6,
  maxLon: -110.9,
};

/**
 * Fixed-width GHCN-Daily station inventory (ghcnd-stations.txt).
 *   ID 1-11, LATITUDE 13-20, LONGITUDE 22-30, ELEVATION 32-37, STATE 39-40,
 *   NAME 42-71
 */
export function parseGhcndStations(text) {
  const stations = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.length < 40) continue;
    const latitude = Number.parseFloat(line.slice(12, 20));
    const longitude = Number.parseFloat(line.slice(21, 30));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    stations.push({
      id: line.slice(0, 11).trim(),
      latitude,
      longitude,
      elevationM: Number.parseFloat(line.slice(31, 37)),
      state: line.slice(38, 40).trim(),
      name: line.slice(41, 71).trim(),
    });
  }
  return stations;
}

/**
 * Stations that could plausibly have a published 1991-2020 normals file.
 * US-prefixed ids only (USW/USC), in Utah, inside the box.
 */
export function candidateStations(stations, box = MARKET_STATION_BOX) {
  return stations
    .filter(
      (s) =>
        s.state === "UT" &&
        /^US[CW]/.test(s.id) &&
        s.latitude >= box.minLat &&
        s.latitude <= box.maxLat &&
        s.longitude >= box.minLon &&
        s.longitude <= box.maxLon,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

const REQUIRED_ZCTA_COLUMNS = [
  "GEOID_ZCTA5_20",
  "GEOID_COUNTY_20",
  "AREALAND_ZCTA5_20",
  "AREALAND_PART",
];

/**
 * Census ZCTA-to-county relationship file (pipe-delimited).
 *
 * A ZCTA is kept when at least `minShare` of its land area lies inside the
 * market counties. That keeps a ZIP that straddles a county line and drops one
 * that only clips the edge of the market.
 *
 * Columns are found by name and the function throws if any are missing, so a
 * format change at the Census fails loudly instead of producing an empty list.
 */
export function selectZctas(text, countyFips = MARKET_COUNTY_FIPS, minShare = 0.1) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = (lines[0] ?? "").replace(/^﻿/, "").split("|");
  const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

  const missing = REQUIRED_ZCTA_COLUMNS.filter((c) => !(c in col));
  if (missing.length > 0) {
    throw new Error(`ZCTA file is missing expected columns: ${missing.join(", ")}`);
  }

  const counties = new Set(countyFips);
  const inside = new Map(); // zcta -> land area inside the market
  const total = new Map(); // zcta -> land area of the whole ZCTA

  for (const line of lines.slice(1)) {
    const cells = line.split("|");
    const zcta = (cells[col.GEOID_ZCTA5_20] ?? "").trim();
    const county = (cells[col.GEOID_COUNTY_20] ?? "").trim();
    if (!/^\d{5}$/.test(zcta)) continue;

    total.set(zcta, Number(cells[col.AREALAND_ZCTA5_20]) || 0);
    if (counties.has(county)) {
      inside.set(zcta, (inside.get(zcta) ?? 0) + (Number(cells[col.AREALAND_PART]) || 0));
    }
  }

  const kept = [];
  for (const [zcta, area] of inside) {
    const whole = total.get(zcta) ?? 0;
    if (whole > 0 && area / whole >= minShare) kept.push(zcta);
  }
  return kept.sort();
}

/** Every five-digit quoted string in an existing wasatch-zips.ts. */
export function zipsFromModule(source) {
  return [...source.matchAll(/"(\d{5})"/g)].map((m) => m[1]);
}

export function renderZipsModule(zips) {
  const rows = [];
  for (let i = 0; i < zips.length; i += 8) {
    rows.push(`  ${zips.slice(i, i + 8).map((z) => JSON.stringify(z)).join(", ")},`);
  }
  return `/**
 * ZIP codes for the launch market: Salt Lake, Utah, Davis and Weber counties.
 *
 * GENERATED - do not edit by hand. Regenerate by running the "Refresh
 * reference data" workflow, or:
 *
 *   node scripts/select-zips.mjs <census-zcta-county-file> apps/ingest/src/wasatch-zips.ts
 *
 * Source: U.S. Census Bureau 2020 ZCTA-to-county relationship file. A ZCTA is
 * kept when at least 10% of its land area is inside the four counties. ZCTAs
 * approximate ZIP codes but are not identical, so ZIPs from the previous list
 * are kept as well.
 *
 * A ZIP that is missing here means a real gardener hears "we do not cover your
 * area yet" for an address we do intend to cover.
 */
export const WASATCH_FRONT_ZIPS: readonly string[] = [
${rows.join("\n")}
];
`;
}
