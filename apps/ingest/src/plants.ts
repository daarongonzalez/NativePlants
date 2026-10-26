import { createDatabase, recordProvenance, upsertPlants } from "@np/db";
import { parsePlantCsv } from "@np/shared";
import type { IngestEnv, IngestJob, IngestResult } from "./types";

/**
 * Plant catalogue import.
 *
 * Reads the curation spreadsheet (exported as `data/plants/wasatch-plants.csv`)
 * and upserts it into `plants`. Not an API pull: the catalogue is curated by a
 * person, and the CSV in git is the record of what they decided.
 *
 * All or nothing. If any row fails validation, nothing is written and every
 * error is reported with its row number, so a half-imported sheet can never
 * leave the catalogue in a state nobody reviewed.
 *
 * Rows marked `draft` are imported (so progress is visible and testable) but
 * only `published` rows are ever served to gardeners.
 */

export class PlantImportJob implements IngestJob {
  readonly name = "plants";

  constructor(private readonly csv: string) {}

  async run(env: IngestEnv): Promise<IngestResult> {
    const { plants, errors } = parsePlantCsv(this.csv);

    if (errors.length > 0) {
      return { job: this.name, rowsWritten: 0, rowsSkipped: errors.length, warnings: ["Nothing imported.", ...errors] };
    }
    if (plants.length === 0) {
      return { job: this.name, rowsWritten: 0, rowsSkipped: 0, warnings: ["The plant sheet has no rows yet."] };
    }

    const db = createDatabase(env.HYPERDRIVE.connectionString);
    const retrievedAt = new Date();

    const written = await upsertPlants(db, env.MARKET, plants, retrievedAt);
    const byName = new Map(plants.map((p) => [p.scientificName, p]));

    for (const { id, scientificName } of written) {
      const p = byName.get(scientificName)!;
      await recordProvenance(db, [
        {
          tableName: "plants",
          recordId: id,
          source: "curated",
          citation: `Curated by ${p.curatedBy || "unassigned"}; review status ${p.reviewStatus}. Source: data/plants/wasatch-plants.csv`,
          retrievedAt,
        },
      ]);
    }

    return { job: this.name, rowsWritten: plants.length, rowsSkipped: 0, warnings: [] };
  }
}
