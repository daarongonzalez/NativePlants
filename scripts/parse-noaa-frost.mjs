#!/usr/bin/env node
/**
 * Turn NCEI Annual/Seasonal Climate Normals CSVs into our FrostRecord shape.
 *
 *   node scripts/parse-noaa-frost.mjs <file-or-dir> [...] > apps/ingest/src/data/wasatch-frost.ts
 *
 * Input is the 1991-2020 annualseasonal normals, one CSV per station:
 *   https://www.ncei.noaa.gov/data/normals-annualseasonal/1991-2020/access/<STATION>.csv
 *
 * The columns we want are buried in a ~1,200 column file. Naming decodes as
 * ANN - TMIN - PRB{LST,FST,GSL} - T{threshold}F - P{probability}:
 *
 *   PRBLST  last spring occurrence of the threshold
 *   PRBFST  first fall occurrence
 *   PRBGSL  growing season length, in days
 *
 * We take the 32F threshold, which is the freeze a gardener plans around.
 *
 * Dates arrive as MM/DD and are stored as MM-DD, because they recur annually
 * and a full date would imply a specific year's event rather than a normal.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const THRESHOLD = "T32F";

/** NCEI missing-value sentinels. -7777 means "non-zero but rounds to zero". */
const SENTINELS = new Set(["-9999", "-8888", "-7777", "-6666", ""]);

/** Minimal RFC4180 parser. The files are quoted and contain no embedded newlines. */
function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const cells = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i += 1; } else { inQuotes = false; }
        } else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

function toRecordList(text) {
  const rows = parseCsv(text);
  const header = rows[0];
  return rows.slice(1).map((cells) => {
    const o = {};
    header.forEach((h, i) => { o[h] = cells[i] ?? ""; });
    return o;
  });
}

function value(row, column) {
  const raw = (row[column] ?? "").trim();
  return SENTINELS.has(raw) ? null : raw;
}

/** "04/21" -> "04-21". Returns null for anything that is not MM/DD. */
function toMonthDay(raw) {
  if (raw === null) return null;
  const m = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/.exec(raw);
  return m ? `${m[1]}-${m[2]}` : null;
}

function toRecord(row) {
  const stationId = value(row, "STATION");
  if (!stationId) return { skipped: "no station id" };

  const pick = (kind, p) => toMonthDay(value(row, `ANN-TMIN-PRB${kind}-${THRESHOLD}P${p}`));

  const lastSpringP10 = pick("LST", "10");
  const lastSpringP50 = pick("LST", "50");
  const lastSpringP90 = pick("LST", "90");
  const firstFallP10 = pick("FST", "10");
  const firstFallP50 = pick("FST", "50");
  const firstFallP90 = pick("FST", "90");

  // A station with no 32F normals is usually somewhere that does not freeze.
  // Not an error, just not useful to us.
  if (!lastSpringP10 || !lastSpringP50 || !lastSpringP90 ||
      !firstFallP10 || !firstFallP50 || !firstFallP90) {
    return { skipped: `${stationId}: no complete 32F frost normals` };
  }

  const gsl = value(row, `ANN-TMIN-PRBGSL-${THRESHOLD}P50`);
  const frostFreeDays = gsl === null ? null : Number.parseInt(gsl, 10);
  if (frostFreeDays === null || Number.isNaN(frostFreeDays)) {
    return { skipped: `${stationId}: no growing season length` };
  }

  const latitude = Number(value(row, "LATITUDE"));
  const longitude = Number(value(row, "LONGITUDE"));
  const elevationRaw = value(row, "ELEVATION");

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { skipped: `${stationId}: missing coordinates` };
  }

  // A later 10% last-spring date than the 50% is the signature of swapped
  // columns, and it reverses every piece of advice downstream. Refuse rather
  // than store it.
  if (!(lastSpringP10 > lastSpringP50 && lastSpringP50 > lastSpringP90)) {
    return { skipped: `${stationId}: last-spring bands out of order` };
  }
  if (!(firstFallP10 < firstFallP50 && firstFallP50 < firstFallP90)) {
    return { skipped: `${stationId}: first-fall bands out of order` };
  }

  return {
    record: {
      stationId,
      name: (value(row, "NAME") ?? stationId).replace(/\s+/g, " ").trim(),
      latitude,
      longitude,
      // NCEI reports elevation in metres, which is what our schema stores.
      elevationM: elevationRaw === null ? null : Number(elevationRaw),
      lastSpringP10, lastSpringP50, lastSpringP90,
      firstFallP10, firstFallP50, firstFallP90,
      frostFreeDays,
      normalsPeriod: "1991-2020",
    },
  };
}

function collectFiles(paths) {
  const files = [];
  for (const p of paths) {
    if (statSync(p).isDirectory()) {
      for (const f of readdirSync(p)) if (f.endsWith(".csv")) files.push(join(p, f));
    } else files.push(p);
  }
  return files;
}

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  console.error("usage: node scripts/parse-noaa-frost.mjs <file-or-dir> [...]");
  process.exit(2);
}

const records = [];
const skipped = [];
for (const file of collectFiles(inputs)) {
  for (const row of toRecordList(readFileSync(file, "utf8"))) {
    const out = toRecord(row);
    if (out.record) records.push(out.record);
    else skipped.push(out.skipped);
  }
}

records.sort((a, b) => a.stationId.localeCompare(b.stationId));

for (const s of skipped) console.error(`skipped: ${s}`);
console.error(`\n${records.length} station(s) parsed, ${skipped.length} skipped`);

const body = records
  .map((r) => `  {
    stationId: ${JSON.stringify(r.stationId)},
    name: ${JSON.stringify(r.name)},
    latitude: ${r.latitude},
    longitude: ${r.longitude},
    elevationM: ${r.elevationM},
    lastSpringP10: ${JSON.stringify(r.lastSpringP10)},
    lastSpringP50: ${JSON.stringify(r.lastSpringP50)},
    lastSpringP90: ${JSON.stringify(r.lastSpringP90)},
    firstFallP10: ${JSON.stringify(r.firstFallP10)},
    firstFallP50: ${JSON.stringify(r.firstFallP50)},
    firstFallP90: ${JSON.stringify(r.firstFallP90)},
    frostFreeDays: ${r.frostFreeDays},
    normalsPeriod: ${JSON.stringify(r.normalsPeriod)},
  },`)
  .join("\n");

process.stdout.write(`import type { FrostRecord } from "../frost";

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
${body}
];
`);
