import { createDatabase, recordProvenance, upsertRebateProgram } from "@np/db";
import { rebateProgramFileSchema } from "@np/shared";
import type { IngestEnv, IngestJob, IngestResult } from "./types";

/**
 * Rebate program import.
 *
 * Reads a program file from `data/rebates/` and loads the program, its
 * participating areas and its rules. Like the plant sheet, the file in git is
 * the record of what we checked and when; this job only copies it in.
 *
 * All or nothing: a file that fails validation writes nothing.
 */
export class RebateImportJob implements IngestJob {
  readonly name = "rebates";

  constructor(private readonly files: readonly unknown[]) {}

  async run(env: IngestEnv): Promise<IngestResult> {
    const parsed = this.files.map((f) => rebateProgramFileSchema.safeParse(f));
    const errors = parsed.flatMap((p, i) =>
      p.success ? [] : p.error.issues.map((issue) => `File ${i + 1}: ${issue.path.join(".")} ${issue.message}`),
    );
    if (errors.length > 0) {
      return { job: this.name, rowsWritten: 0, rowsSkipped: errors.length, warnings: ["Nothing imported.", ...errors] };
    }

    const db = createDatabase(env.HYPERDRIVE.connectionString);
    let rowsWritten = 0;
    const warnings: string[] = [];

    for (const p of parsed) {
      if (!p.success) continue;
      const file = p.data;
      const written = await upsertRebateProgram(db, file);
      rowsWritten += 1 + written.rules + written.areas;
      if (file.areas.length === 0) {
        warnings.push(`${file.code}: no participating communities listed yet.`);
      }
      await recordProvenance(db, [
        {
          tableName: "rebate_programs",
          recordId: written.programId,
          source: "curated",
          citation: `${file.name}, rules version ${file.rulesVersion}. ${file.verifiedBy}`,
          sourceUrl: file.sourceUrl,
          retrievedAt: new Date(`${file.verifiedAt}T00:00:00Z`),
        },
      ]);
    }

    return { job: this.name, rowsWritten, rowsSkipped: 0, warnings };
  }
}
