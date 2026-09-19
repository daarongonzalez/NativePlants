import { createDatabase, recordProvenance, schema } from "@np/db";
import { zoneToOrdinal } from "@np/shared";
import type { IngestEnv, IngestJob, IngestResult } from "./types";

/**
 * Hardiness zone ingestion.
 *
 * USDA publishes no API — an open request for one has sat on their GitHub for
 * years — so this reads phzmapi.org, a community static API built from PRISM
 * data in the shape `{ZIP}.json`. Coverage is incomplete, which is why a
 * missing ZIP is a skip rather than a failure.
 *
 * NOT VERIFIED AGAINST A LIVE RESPONSE. The build environment's egress policy
 * blocks phzmapi.org, so the field paths below are written to its documented
 * shape and the first real run is their first test.
 *
 * A ZIP list is required input rather than something we discover, because
 * enumerating every US ZIP would be tens of thousands of requests against a
 * volunteer-run service for data we do not need outside our launch market.
 */

const SOURCE_URL = "https://phzmapi.org";

interface ZoneResponse {
  zone?: unknown;
  temperature_range?: unknown;
  coordinates?: unknown;
}

function parseTempRange(raw: unknown): { min: number; max: number } | null {
  if (typeof raw !== "string") return null;
  // Documented shape is like "5 to 10" or "-10 to -5".
  const match = /^(-?\d+(?:\.\d+)?)\s*to\s*(-?\d+(?:\.\d+)?)$/.exec(raw.trim());
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (Number.isNaN(min) || Number.isNaN(max)) return null;
  return { min, max };
}

export class HardinessZoneJob implements IngestJob {
  readonly name = "hardiness-zones";

  constructor(
    private readonly zips: readonly string[],
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async run(env: IngestEnv): Promise<IngestResult> {
    const db = createDatabase(env.HYPERDRIVE.connectionString);
    const warnings: string[] = [];
    const retrievedAt = new Date();
    let rowsWritten = 0;
    let rowsSkipped = 0;

    for (const zip of this.zips) {
      let payload: ZoneResponse;
      try {
        const response = await this.fetchImpl(`${SOURCE_URL}/${zip}.json`, {
          headers: { accept: "application/json" },
        });
        // A 404 means this ZIP is outside the dataset, which is expected.
        if (response.status === 404) {
          rowsSkipped += 1;
          continue;
        }
        if (!response.ok) {
          warnings.push(`${zip}: HTTP ${response.status}`);
          rowsSkipped += 1;
          continue;
        }
        payload = (await response.json()) as ZoneResponse;
      } catch (error) {
        warnings.push(`${zip}: ${error instanceof Error ? error.message : "fetch failed"}`);
        rowsSkipped += 1;
        continue;
      }

      const ordinal = typeof payload.zone === "string" ? zoneToOrdinal(payload.zone) : null;
      const range = parseTempRange(payload.temperature_range);

      if (ordinal === null || range === null) {
        // Refuse to guess. A wrong zone silently filters the entire plant
        // catalogue for every gardener in that ZIP.
        warnings.push(`${zip}: unparseable zone or temperature range`);
        rowsSkipped += 1;
        continue;
      }

      await db
        .insert(schema.hardinessZones)
        .values({
          zip,
          zoneOrdinal: ordinal,
          tempMinF: range.min,
          tempMaxF: range.max,
          sourceYear: 2023,
        })
        .onConflictDoUpdate({
          target: schema.hardinessZones.zip,
          set: { zoneOrdinal: ordinal, tempMinF: range.min, tempMaxF: range.max, sourceYear: 2023 },
        });

      await recordProvenance(db, [
        {
          tableName: "hardiness_zones",
          recordId: zip,
          source: "usda_phzm",
          license: "public domain (USDA/PRISM derived)",
          citation: "USDA Plant Hardiness Zone Map, 2023 revision, via phzmapi.org",
          sourceUrl: `${SOURCE_URL}/${zip}.json`,
          retrievedAt,
        },
      ]);

      rowsWritten += 1;
    }

    return { job: this.name, rowsWritten, rowsSkipped, warnings };
  }
}
