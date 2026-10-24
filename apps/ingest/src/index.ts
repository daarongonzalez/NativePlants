import { FrostNormalsJob } from "./frost";
import { HardinessZoneJob } from "./zones";
import { PlantImportJob } from "./plants";
import { SoilJob } from "./soil";
import plantsCsv from "../../../data/plants/wasatch-plants.csv";
import type { IngestEnv, IngestJob, IngestResult } from "./types";
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
   * Manual trigger, for running a job outside the monthly cron.
   *
   * A deployed Worker with a fetch handler is reachable at a public
   * workers.dev URL, so this is gated on a shared secret. With RUN_TOKEN
   * unset the route refuses entirely rather than running open — failing
   * closed is the only safe default for something that writes to the
   * database.
   */
  async fetch(request: Request, env: IngestEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/__run" || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    if (!env.RUN_TOKEN) {
      return Response.json(
        { error: "RUN_TOKEN is not configured, so the manual run route is disabled." },
        { status: 503 },
      );
    }

    const offered = request.headers.get("Authorization");
    if (offered !== `Bearer ${env.RUN_TOKEN}`) {
      return new Response("Not found", { status: 404 });
    }

    // Soil is heavy and the plant import is a deliberate act, so both are
    // opt-in rather than part of the default run.
    const job = url.searchParams.get("job");

    if (job === "soil") return runSoil(env, url.searchParams.get("cursor"));

    const results =
      job === "plants" ? await runJobs(env, [new PlantImportJob(plantsCsv)]) : await runAll(env);
    return Response.json({ results });
  },
} satisfies ExportedHandler<IngestEnv>;

/**
 * Soil runs in slices (see soil.ts). Without a cursor this does no work and
 * returns the survey areas to load; with one it loads about a minute of map
 * units and returns the cursor for the next call, or null when the area is done.
 */
async function runSoil(env: IngestEnv, rawCursor: string | null): Promise<Response> {
  const job = new SoilJob();
  if (rawCursor === null) return Response.json({ plan: job.plan() });

  const cursor = job.cursor(rawCursor);
  if (!cursor) return Response.json({ error: "Not a valid soil cursor." }, { status: 400 });

  try {
    const { next, ...result } = await job.runSlice(env, cursor);
    if (result.rowsWritten === 0 && next === null) console.warn("soil: wrote no rows", result.warnings.slice(0, 5));
    else console.log(`soil ${rawCursor}: ${result.rowsWritten} written, next ${next}`);
    return Response.json({ results: [result], next });
  } catch (error) {
    console.error("soil slice threw", error);
    const message = error instanceof Error ? error.message : "unknown failure";
    return Response.json(
      { results: [{ job: "soil", rowsWritten: 0, rowsSkipped: 0, warnings: [message] }], next: rawCursor },
      { status: 200 },
    );
  }
}

async function runAll(env: IngestEnv): Promise<IngestResult[]> {
  return runJobs(env, [new HardinessZoneJob(WASATCH_FRONT_ZIPS), new FrostNormalsJob(WASATCH_FRONT_FROST)]);
}

async function runJobs(env: IngestEnv, jobs: IngestJob[]): Promise<IngestResult[]> {
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
