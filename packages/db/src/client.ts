import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDatabase>;

/**
 * One client per request, built from the Hyperdrive binding's connection
 * string.
 *
 * Two things here are easy to get wrong and both come from Cloudflare's own
 * guidance:
 *
 *  - Use `pg` (>= 8.16.3) or postgres.js, NOT the Neon serverless driver.
 *    Hyperdrive speaks the wire protocol directly.
 *  - Point Hyperdrive at Neon's DIRECT connection string, not the pooled one.
 *    Hyperdrive does the pooling; doubling up causes problems.
 */
export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 5 });
  return drizzle(pool, { schema });
}

export { schema };
