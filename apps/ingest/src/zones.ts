import { createDatabase, recordProvenance, schema } from "@np/db";
import { zoneToOrdinal } from "@np/shared";
import type { IngestEnv, IngestJob, IngestResult } from "./types";

/**
 * Hardiness zone ingestion.
 *
 * USDA publishes no API, but the 2023 map was produced by the PRISM Group at
 * Oregon State University, which publishes the zone for every US ZIP code as
 * one CSV. We read that file directly. An earlier version read phzmapi.org, a
 * community wrapper around the same data; it was missing 24 of our 88 ZIPs,
 * including all of Weber County, and its values matched this file for every
 * ZIP it did have.
 *
 * Terms (https://prism.oregonstate.edu/phzm/): the data "may be freely
 * reproduced and redistributed". Any description of it must name the PRISM
 * Group, Oregon State University, the URL and the date of access, which is what
 * the provenance rows below record.
 *
 * ZIPs are matched against a list we supply rather than loading all ~40,000.
 */

export const PRISM_ZIP_CSV_URL = "https://prism.oregonstate.edu/phzm/data/2023/phzm_us_zipcode_2023.csv";

/** The real file has ~39,900 rows. Far fewer means the format or the URL changed. */
const MIN_EXPECTED_ROWS = 30_000;

/**
 * Default fetch, wrapped rather than passed bare.
 *
 * `= fetch` captures the global without its binding, so calling it as
 * `this.fetchImpl(...)` sets `this` to the instance and the Workers runtime
 * throws "Illegal invocation". Node tolerates it, so this only appeared in
 * production.
 */
const defaultFetch: typeof fetch = (...args) => fetch(...args);

export interface ZipZone {
  zone: string;
  min: number;
  max: number;
}

/** "5 to 10" or "-10 to -5". The file always uses a literal " to ". */
function parseTempRange(raw: string): { min: number; max: number } | null {
  const match = /^(-?\d+(?:\.\d+)?)\s*to\s*(-?\d+(?:\.\d+)?)$/.exec(raw.trim());
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  return Number.isNaN(min) || Number.isNaN(max) ? null : { min, max };
}

/**
 * Parse the PRISM ZIP file: `zipcode,zone,trange,zonetitle`.
 *
 * Columns are found by name, and a missing column throws so a format change
 * fails loudly instead of loading nothing. Rows that do not parse are counted
 * and returned rather than guessed at.
 */
export function parsePrismZipCsv(text: string): { zips: Map<string, ZipZone>; badRows: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = (lines[0] ?? "").replace(/^﻿/, "").split(",").map((h) => h.trim());
  const col = { zip: header.indexOf("zipcode"), zone: header.indexOf("zone"), range: header.indexOf("trange") };
  if (col.zip < 0 || col.zone < 0 || col.range < 0) {
    throw new Error(`PRISM ZIP file is missing expected columns; header was: ${header.join(",")}`);
  }

  const zips = new Map<string, ZipZone>();
  const badRows: string[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    const zip = (cells[col.zip] ?? "").trim();
    const zone = (cells[col.zone] ?? "").trim();
    const range = parseTempRange(cells[col.range] ?? "");
    if (!/^\d{5}$/.test(zip) || zoneToOrdinal(zone) === null || range === null) {
      badRows.push(zip || line.slice(0, 20));
      continue;
    }
    zips.set(zip, { zone, ...range });
  }
  return { zips, badRows };
}

export class HardinessZoneJob implements IngestJob {
  readonly name = "hardiness-zones";

  constructor(
    private readonly zips: readonly string[],
    private readonly fetchImpl: typeof fetch = defaultFetch,
  ) {}

  async run(env: IngestEnv): Promise<IngestResult> {
    const warnings: string[] = [];

    let text: string;
    try {
      const response = await this.fetchImpl(PRISM_ZIP_CSV_URL);
      if (!response.ok) {
        return { job: this.name, rowsWritten: 0, rowsSkipped: this.zips.length, warnings: [`PRISM ZIP file: HTTP ${response.status}`] };
      }
      text = await response.text();
    } catch (error) {
      const message = error instanceof Error ? error.message : "fetch failed";
      return { job: this.name, rowsWritten: 0, rowsSkipped: this.zips.length, warnings: [`PRISM ZIP file: ${message}`] };
    }

    const { zips: available, badRows } = parsePrismZipCsv(text);
    if (available.size < MIN_EXPECTED_ROWS) {
      return {
        job: this.name,
        rowsWritten: 0,
        rowsSkipped: this.zips.length,
        warnings: [`PRISM ZIP file parsed to only ${available.size} ZIPs; expected about 39,900. Refusing to load.`],
      };
    }
    if (badRows.length > 0) {
      warnings.push(`${badRows.length} rows in the PRISM file could not be parsed (first few: ${badRows.slice(0, 5).join(" ")})`);
    }

    const db = createDatabase(env.HYPERDRIVE.connectionString);
    const retrievedAt = new Date();
    const accessed = retrievedAt.toISOString().slice(0, 10);
    const notInDataset: string[] = [];
    let rowsWritten = 0;

    for (const zip of this.zips) {
      const entry = available.get(zip);
      if (!entry) {
        notInDataset.push(zip);
        continue;
      }
      const ordinal = zoneToOrdinal(entry.zone);
      if (ordinal === null) continue; // already screened in the parser

      await db
        .insert(schema.hardinessZones)
        .values({ zip, zoneOrdinal: ordinal, tempMinF: entry.min, tempMaxF: entry.max, sourceYear: 2023 })
        .onConflictDoUpdate({
          target: schema.hardinessZones.zip,
          set: { zoneOrdinal: ordinal, tempMinF: entry.min, tempMaxF: entry.max, sourceYear: 2023 },
        });

      await recordProvenance(db, [
        {
          tableName: "hardiness_zones",
          recordId: zip,
          source: "usda_phzm",
          license: "freely reproduced and distributed with attribution (PRISM Group, Oregon State University)",
          citation: `USDA Plant Hardiness Zone Map, 2023 revision. PRISM Group, Oregon State University, https://prism.oregonstate.edu, accessed ${accessed}.`,
          sourceUrl: PRISM_ZIP_CSV_URL,
          retrievedAt,
        },
      ]);

      rowsWritten += 1;
    }

    // Expected to be rare now, but never silent: these are ZIPs we intend to
    // cover and the source does not have.
    if (notInDataset.length > 0) {
      warnings.unshift(`${notInDataset.length} ZIPs not in the PRISM file: ${notInDataset.join(" ")}`);
    }

    return { job: this.name, rowsWritten, rowsSkipped: notInDataset.length, warnings };
  }
}
