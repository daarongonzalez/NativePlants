# Research: the API on Bun and SQLite

Status: research only, 21 November 2026. Nothing has changed in the code.

The question: what would it take to run `apps/api` on Bun with SQLite in
place of Cloudflare Workers, Hyperdrive and Neon Postgres?

## The short answer

- **The routes move easily.** Hono runs on Bun as it is. `export default app`
  in `apps/api/src/index.ts` already works with `Bun.serve`.
- **The database is the real work.** Drizzle supports SQLite, but the schema
  leans on Postgres types and on PostGIS for three location lookups.
- **The hosting change is the hidden cost.** Bun does not run on Workers. The
  API would leave Cloudflare's network and live on one server with a disk.
- **Rough size:** 6 to 10 working days, most of it in `packages/db` and tests.

## What carries over unchanged

- Every Hono route, the Zod checks and the error handling.
- `packages/engine`, `packages/shared` and most of `packages/sources`. They
  are plain TypeScript with `fetch`.
- The Cloudflare Access check (`access.ts`) and Firebase sign-in. Both use Web
  Crypto, which Bun has.
- Drizzle's query style: `select`, `insert … onConflictDoUpdate`, `returning`
  and `transaction` all work on SQLite.

## What has to change

### 1. Column types (`packages/db/src/schema.ts`)

| Postgres today | SQLite version |
|---|---|
| `uuid().defaultRandom()` | `text`, filled with `crypto.randomUUID()` |
| `timestamp(withTimezone)` | `integer` (milliseconds), Drizzle `mode: "timestamp_ms"` |
| `jsonb` (profile provenance, rule parameters) | `text` with Drizzle `mode: "json"` |
| `numeric` (rebate amounts, reported values) | `integer` cents, or `real` |
| `boolean` | `integer` with Drizzle `mode: "boolean"` |
| `date` | `text` (`YYYY-MM-DD`) |

The four migrations (0000 to 0003) would be regenerated as one fresh SQLite
migration with `drizzle-kit`. There is no SQLite version of the existing data
to carry forward except the reference tables, which ingest rebuilds anyway.

### 2. Location lookups (the hard part)

PostGIS does three jobs today:

| Job | Where | SQLite option |
|---|---|---|
| Nearest climate station (KNN `<->`, `ST_Distance` in metres) | `resolve-repo.ts` | Few rows: load them and pick the nearest with a distance formula in TypeScript |
| Which soil map unit holds a point (`ST_Covers`) | `resolve-repo.ts` | SQLite's built-in R*Tree index on each unit's bounding box, then a point-in-polygon check in TypeScript |
| Repairing soil outlines on the way in (`ST_MakeValid`) | `geometry.ts`, `apps/ingest` | Repair at ingest with a JS library, or ship SpatiaLite |

There are about 471 soil map units, so the R*Tree route is fast enough and
avoids a native extension. SpatiaLite would keep the SQL close to today's,
but it is a native add-on to install on the server, and macOS's built-in
SQLite blocks extensions (Bun needs `Database.setCustomSQLite` there).

Recommendation: R*Tree plus TypeScript checks. It keeps the setup to Bun alone.

### 3. Small SQL differences

- `is distinct from` (plant review reset in `resolve-repo.ts`) becomes `IS NOT`.
- `count(*)::int` and the `::geography` casts are dropped.
- `ST_X` / `ST_Y` on `sites.geom` become plain `latitude` and `longitude`
  columns.
- Transactions: Bun's SQLite driver is synchronous. Drizzle hides most of
  this, but no `await fetch(...)` may sit inside a transaction.

### 4. Cloudflare features the API uses

| Today | On Bun |
|---|---|
| `HYPERDRIVE` binding | A file path, e.g. `DATABASE_PATH=/data/nativo.db` |
| `AUTH_KEYS` KV (Google's signing keys) | An in-memory cache, or a small SQLite table |
| `caches.default` for yard estimates (`public.ts`) | A SQLite table with an expiry time |
| `executionCtx.waitUntil` (alerts, cache writes) | Start the promise and let it run |
| `[vars]` and dashboard secrets | A `.env` file on the server, kept out of the repo |
| Ingest Worker's monthly cron | A system cron job running a Bun script |
| Workers Logs | The host's logs, or a log service |

### 5. How the site reaches the API

Today the site calls the API through a **service binding**, and the API has
no public address. That is a real safety feature: visitors can only reach it
through the site's rate limits.

On a separate server, the API needs a public address. To keep the same
protection:

- Put it behind a Cloudflare Tunnel, so it still has no open port.
- Have the site send a shared secret header, and reject requests without it.

`apps/web/app/lib/api.server.ts` already supports `API_URL`, so the site side
is a one-line setting.

### 6. Running it

- One server with a disk: Fly.io, Railway, Hetzner or similar.
- Backups: Litestream, copying the database to R2 or S3 continuously. This
  replaces Neon's branches and point-in-time restore.
- One region. Today the API runs close to every visitor; on Bun it runs in
  one place. For a Utah-first product this matters little.

## What you would gain

- **Tests that always run.** The four database suites skip today without a
  Postgres and PostGIS. With SQLite, each test opens a fresh `:memory:`
  database, so the cross-account checks run on every `pnpm check`.
- **Simpler local setup.** No Neon branch or Hyperdrive to run the API locally.
- **Fewer accounts.** Neon and Hyperdrive drop out.
- **Fast reads.** SQLite on the same disk answers in microseconds.

## What you would give up

- Running at the edge, and the service binding's "no public address" setup.
- Neon branches for testing changes on a copy of the database.
- PostGIS, if the product later needs real map work (rebate areas drawn as
  shapes, distance to water, lot outlines).
- One managed platform. A server needs updates, backups and watching.

## A middle path worth knowing about

**Cloudflare D1** is SQLite, run by Cloudflare, usable from Workers. It would:

- keep Workers, the service binding, KV, caching and the cron as they are;
- still need the column and location changes above (sections 1 to 3);
- skip sections 4 to 6 entirely.

So if the goal is SQLite's simplicity, D1 gets most of it for about half the
work. If the goal is Bun itself (speed, its test runner, its tools), Bun can
also be used today for local scripts and tests without moving the API.

## Suggested order, if this ever goes ahead

1. Add plain `latitude` / `longitude` columns next to the geometry ones and
   move the three location lookups into TypeScript, still on Postgres. This
   is the riskiest step and can be checked against today's answers.
2. Write the SQLite schema and one migration; run the database tests on
   `:memory:` SQLite.
3. Choose D1 or Bun for hosting. Swap the database client in
   `packages/db/src/client.ts`.
4. Copy reference data with the ingest job; copy user tables with a one-off
   script.
5. Run both side by side for a week, compare answers, then switch the site's
   `API_URL` or binding.

## Recommendation

Not now. The current setup works, and the launch list in
[status.md](status.md) is the better use of time. If it comes up again, step 1
above is useful on its own: it removes the PostGIS dependency and makes any
later move, to D1 or Bun, much smaller.
