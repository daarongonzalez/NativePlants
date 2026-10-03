import { createDatabase, recordProvenance, schema } from "@np/db";
import { sql } from "drizzle-orm";
import type { IngestEnv, IngestJob, IngestResult } from "./types";

/**
 * Frost normals ingestion.
 *
 * NOAA NCEI publishes US Climate Normals as bulk files rather than a
 * per-station API worth calling at ingest time, and the freeze/frost
 * probability tables are a separate product from the daily normals. So this
 * job takes already-parsed records as input and its job is to load them
 * correctly and idempotently.
 *
 * Parsing the NOAA bulk file is a separate offline step, deliberately: it is
 * a one-time-per-decade task, the file is large, and doing it inside a Worker
 * with a CPU limit would be the wrong place. The parsed output is committed
 * alongside this job so the load is reviewable.
 *
 * Dates are stored as MM-DD text because they recur annually — a full date
 * would imply a specific year's event rather than a 30-year normal.
 */

export interface FrostRecord {
  stationId: string;
  name: string;
  latitude: number;
  longitude: number;
  elevationM: number | null;
  /** 10 / 50 / 90 percent probability thresholds, as MM-DD. */
  lastSpringP10: string;
  lastSpringP50: string;
  lastSpringP90: string;
  firstFallP10: string;
  firstFallP50: string;
  firstFallP90: string;
  frostFreeDays: number;
  normalsPeriod: string;
}

const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function validate(record: FrostRecord): string | null {
  for (const [field, value] of [
    ["lastSpringP10", record.lastSpringP10],
    ["lastSpringP50", record.lastSpringP50],
    ["lastSpringP90", record.lastSpringP90],
    ["firstFallP10", record.firstFallP10],
    ["firstFallP50", record.firstFallP50],
    ["firstFallP90", record.firstFallP90],
  ] as const) {
    if (!MMDD.test(value)) return `${field} is not MM-DD: ${value}`;
  }

  if (record.latitude < -90 || record.latitude > 90) return "latitude out of range";
  if (record.longitude < -180 || record.longitude > 180) return "longitude out of range";
  if (record.frostFreeDays < 0 || record.frostFreeDays > 366) return "frostFreeDays out of range";

  return null;
}

export class FrostNormalsJob implements IngestJob {
  readonly name = "frost-normals";

  constructor(private readonly records: readonly FrostRecord[]) {}

  async run(env: IngestEnv): Promise<IngestResult> {
    const db = createDatabase(env.HYPERDRIVE.connectionString);
    const warnings: string[] = [];
    const retrievedAt = new Date();
    let rowsWritten = 0;
    let rowsSkipped = 0;

    for (const record of this.records) {
      const problem = validate(record);
      if (problem) {
        // A malformed frost date would be shown to a gardener deciding when
        // to plant. Skip loudly rather than store it.
        warnings.push(`${record.stationId}: ${problem}`);
        rowsSkipped += 1;
        continue;
      }

      await db
        .insert(schema.climateStations)
        .values({
          id: record.stationId,
          name: record.name,
          elevationM: record.elevationM,
          geom: sql`ST_SetSRID(ST_MakePoint(${record.longitude}, ${record.latitude}), 4326)`,
        })
        .onConflictDoUpdate({
          target: schema.climateStations.id,
          set: {
            name: record.name,
            elevationM: record.elevationM,
            geom: sql`ST_SetSRID(ST_MakePoint(${record.longitude}, ${record.latitude}), 4326)`,
          },
        });

      await db
        .insert(schema.frostNorms)
        .values({
          stationId: record.stationId,
          lastSpringP10: record.lastSpringP10,
          lastSpringP50: record.lastSpringP50,
          lastSpringP90: record.lastSpringP90,
          firstFallP10: record.firstFallP10,
          firstFallP50: record.firstFallP50,
          firstFallP90: record.firstFallP90,
          frostFreeDays: record.frostFreeDays,
          normalsPeriod: record.normalsPeriod,
        })
        .onConflictDoUpdate({
          target: schema.frostNorms.stationId,
          set: {
            lastSpringP10: record.lastSpringP10,
            lastSpringP50: record.lastSpringP50,
            lastSpringP90: record.lastSpringP90,
            firstFallP10: record.firstFallP10,
            firstFallP50: record.firstFallP50,
            firstFallP90: record.firstFallP90,
            frostFreeDays: record.frostFreeDays,
            normalsPeriod: record.normalsPeriod,
          },
        });

      await recordProvenance(db, [
        {
          tableName: "frost_norms",
          recordId: record.stationId,
          source: "noaa_normals",
          license: "public domain (US Government work)",
          citation: `NOAA NCEI US Climate Normals, ${record.normalsPeriod}`,
          sourceUrl: "https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals",
          retrievedAt,
        },
      ]);

      rowsWritten += 1;
    }

    return { job: this.name, rowsWritten, rowsSkipped, warnings };
  }
}
