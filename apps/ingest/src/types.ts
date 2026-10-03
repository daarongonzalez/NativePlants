export interface IngestEnv {
  HYPERDRIVE: { connectionString: string };
  MARKET: string;
  /**
   * Shared secret guarding the manual run route.
   *
   * A deployed Worker with a fetch handler gets a public workers.dev URL, so
   * without this anyone could trigger a full ingestion run. Set with
   * `wrangler secret put RUN_TOKEN` or from CI.
   */
  RUN_TOKEN?: string;
}

export interface IngestResult {
  job: string;
  rowsWritten: number;
  rowsSkipped: number;
  warnings: string[];
}

/**
 * Every ingestion job answers the same shape so the scheduled handler can log
 * uniformly and so a job that silently writes nothing is visible rather than
 * indistinguishable from success.
 */
export interface IngestJob {
  readonly name: string;
  run(env: IngestEnv): Promise<IngestResult>;
}
