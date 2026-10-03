#!/usr/bin/env node
/**
 * Reference data verification.
 *
 * Run after the ingestion jobs. Row counts alone do not tell you the load
 * worked — the failure that matters is data that loaded cleanly and is wrong,
 * because a mislabelled frost column produces advice that is exactly backwards
 * and nothing errors.
 *
 *   DATABASE_URL="postgresql://..." node scripts/verify-data.mjs
 *
 * Exits non-zero if any check fails, so it can gate a deploy.
 */
import pg from "pg";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: url, max: 2 });
const results = [];

function check(name, passed, detail) {
  results.push({ name, passed, detail });
}

async function one(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows[0];
}

async function all(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

try {
  // --- Extension ---------------------------------------------------------
  const gis = await one("SELECT count(*)::int AS n FROM pg_extension WHERE extname='postgis'");
  check("PostGIS enabled", gis.n === 1, gis.n === 1 ? "" : "run CREATE EXTENSION postgis");

  // --- Row counts --------------------------------------------------------
  const counts = await one(`
    SELECT
      (SELECT count(*)::int FROM hardiness_zones)  AS zones,
      (SELECT count(*)::int FROM climate_stations) AS stations,
      (SELECT count(*)::int FROM frost_norms)      AS frost,
      (SELECT count(*)::int FROM data_provenance)  AS provenance
  `);
  check("Hardiness zones loaded", counts.zones > 0, `${counts.zones} rows`);
  check("Climate stations loaded", counts.stations > 0, `${counts.stations} rows`);
  check("Frost normals loaded", counts.frost > 0, `${counts.frost} rows`);

  // --- The placeholder must be gone -------------------------------------
  const placeholder = await one(
    "SELECT count(*)::int AS n FROM climate_stations WHERE id LIKE 'PLACEHOLDER-%' OR name ILIKE '%placeholder%'",
  );
  check(
    "No placeholder stations",
    placeholder.n === 0,
    placeholder.n === 0 ? "" : `${placeholder.n} placeholder rows — replace wasatch-frost.ts`,
  );

  // --- Zones look like the Wasatch Front ---------------------------------
  if (counts.zones > 0) {
    const zoneRange = await one(
      "SELECT min(zone_ordinal)::int AS lo, max(zone_ordinal)::int AS hi FROM hardiness_zones",
    );
    // Wasatch Front runs roughly 5b to 7b. Anything far outside means a
    // parsing problem, not a surprising climate.
    const plausible = zoneRange.lo >= 51 && zoneRange.hi <= 82;
    check(
      "Zone ordinals plausible for the Wasatch Front",
      plausible,
      `range ${zoneRange.lo}-${zoneRange.hi}` + (plausible ? "" : " — expected 51-82 (zones 5a-8b)"),
    );
  }

  // --- Frost dates are MM-DD --------------------------------------------
  if (counts.frost > 0) {
    const badFormat = await one(`
      SELECT count(*)::int AS n FROM frost_norms WHERE
        last_spring_p10 !~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' OR
        last_spring_p50 !~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' OR
        last_spring_p90 !~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' OR
        first_fall_p10  !~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' OR
        first_fall_p50  !~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' OR
        first_fall_p90  !~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
    `);
    check("Frost dates are MM-DD", badFormat.n === 0, badFormat.n === 0 ? "" : `${badFormat.n} malformed`);

    /*
     * The check that catches the real failure.
     *
     * A 10% last-spring date is the LATEST of the three: only a 10% chance of
     * frost after it. A 10% first-fall date is the EARLIEST. Load the columns
     * in the wrong order and everything still parses, every date is valid, and
     * the advice is reversed — a gardener plants two weeks early and loses it.
     */
    const badOrder = await all(`
      SELECT station_id, last_spring_p10, last_spring_p50, last_spring_p90,
             first_fall_p10, first_fall_p50, first_fall_p90
      FROM frost_norms
      WHERE NOT (last_spring_p10 > last_spring_p50 AND last_spring_p50 > last_spring_p90)
         OR NOT (first_fall_p10  < first_fall_p50  AND first_fall_p50  < first_fall_p90)
    `);
    check(
      "Frost probability bands ordered correctly",
      badOrder.length === 0,
      badOrder.length === 0
        ? ""
        : `${badOrder.length} station(s) reversed — likely swapped p10/p90 columns: ${badOrder
            .slice(0, 3)
            .map((r) => r.station_id)
            .join(", ")}`,
    );

    const noElevation = await one(
      "SELECT count(*)::int AS n FROM climate_stations WHERE elevation_m IS NULL",
    );
    check(
      "Every station has an elevation",
      noElevation.n === 0,
      noElevation.n === 0
        ? ""
        : `${noElevation.n} without — the frost confidence rule silently drops to medium for these`,
    );

    const outsideUtah = await one(`
      SELECT count(*)::int AS n FROM climate_stations
      WHERE NOT ST_Within(geom, ST_MakeEnvelope(-114.5, 36.8, -108.9, 42.1, 4326))
    `);
    check(
      "Stations fall inside Utah",
      outsideUtah.n === 0,
      outsideUtah.n === 0 ? "" : `${outsideUtah.n} outside — check for swapped lat/lon`,
    );
  }

  // --- Provenance --------------------------------------------------------
  const orphanZones = await one(`
    SELECT count(*)::int AS n FROM hardiness_zones h
    WHERE NOT EXISTS (
      SELECT 1 FROM data_provenance p WHERE p.table_name='hardiness_zones' AND p.record_id = h.zip
    )
  `);
  check(
    "Every zone row has provenance",
    orphanZones.n === 0,
    orphanZones.n === 0 ? "" : `${orphanZones.n} without a source record`,
  );

  const orphanFrost = await one(`
    SELECT count(*)::int AS n FROM frost_norms f
    WHERE NOT EXISTS (
      SELECT 1 FROM data_provenance p WHERE p.table_name='frost_norms' AND p.record_id = f.station_id
    )
  `);
  check(
    "Every frost row has provenance",
    orphanFrost.n === 0,
    orphanFrost.n === 0 ? "" : `${orphanFrost.n} without a source record`,
  );

  // --- ZIP coverage ------------------------------------------------------
  try {
    const src = readFileSync(new URL("../apps/ingest/src/wasatch-zips.ts", import.meta.url), "utf8");
    const wanted = [...src.matchAll(/"(\d{5})"/g)].map((m) => m[1]);
    if (wanted.length > 0) {
      const have = new Set((await all("SELECT zip FROM hardiness_zones")).map((r) => r.zip));
      const missing = wanted.filter((z) => !have.has(z));
      check(
        "Every ZIP in the list resolved to a zone",
        missing.length === 0,
        missing.length === 0
          ? `${wanted.length} ZIPs covered`
          : `${missing.length} of ${wanted.length} missing: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}`,
      );
    }
  } catch {
    // Not fatal — the script still works run from elsewhere.
  }
} catch (error) {
  console.error("\nVerification could not run:", error.message);
  await pool.end();
  process.exit(2);
}

await pool.end();

const pad = Math.max(...results.map((r) => r.name.length));
let failed = 0;
console.log("");
for (const r of results) {
  if (!r.passed) failed += 1;
  const mark = r.passed ? "\u001b[32mPASS\u001b[0m" : "\u001b[31mFAIL\u001b[0m";
  console.log(`  ${mark}  ${r.name.padEnd(pad)}  ${r.detail}`);
}
console.log("");

if (failed > 0) {
  console.log(`${failed} of ${results.length} checks failed.\n`);
  process.exit(1);
}
console.log(`All ${results.length} checks passed.\n`);
