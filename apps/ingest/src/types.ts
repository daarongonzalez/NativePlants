export interface IngestEnv {
  HYPERDRIVE: { connectionString: string };
  MARKET: string;
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
