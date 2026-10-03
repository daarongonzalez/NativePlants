import { FrostNormalsJob } from "./frost";
import { HardinessZoneJob } from "./zones";
import type { IngestEnv, IngestResult } from "./types";
import { WASATCH_FRONT_ZIPS } from "./wasatch-zips";
import { WASATCH_FRONT_FROST } from "./data/wasatch-frost";

/**
 * Scheduled ingestion.
 *
 * Nothing here is ever reached by a user request. If a source is down, these
 * jobs fail and the product keeps working from the last good data — that
 * separation is the point of the whole architecture.
 */
export default {
  async scheduled(_event: ScheduledController, env: IngestEnv, ctx: ExecutionContext) {
    ctx.waitUntil(runAll(env));
  },

  /**
   * Manual trigger for development. Not exposed in production — the deployed
   * Worker has no route, only a cron trigger.
   */
  async fetch(request: Request, env: IngestEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/__run" || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }
    const results = await runAll(env);
    return Response.json({ results });
  },
} satisfies ExportedHandler<IngestEnv>;

async function runAll(env: IngestEnv): Promise<IngestResult[]> {
  const jobs = [
    new HardinessZoneJob(WASATCH_FRONT_ZIPS),
    new FrostNormalsJob(WASATCH_FRONT_FROST),
  ];

  const results: IngestResult[] = [];
  for (const job of jobs) {
    try {
      const result = await job.run(env);
      results.push(result);
      // A job that wrote nothing is a problem worth seeing, not a quiet success.
      if (result.rowsWritten === 0) {
        console.warn(`${job.name}: wrote no rows`, result.warnings.slice(0, 5));
      } else {
        console.log(`${job.name}: ${result.rowsWritten} written, ${result.rowsSkipped} skipped`);
      }
    } catch (error) {
      console.error(`${job.name} threw`, error);
      results.push({
        job: job.name,
        rowsWritten: 0,
        rowsSkipped: 0,
        warnings: [error instanceof Error ? error.message : "unknown failure"],
      });
    }
  }
  return results;
}
