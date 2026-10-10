# Operating Without a Local Environment

Everything this project needs can be driven from GitHub and the Cloudflare and
Neon dashboards. No terminal, no toolchain, no connection strings on your
machine.

## Why this works

The container these sessions run in is behind a strict egress policy — it
cannot reach prism.oregonstate.edu, NCEI, the Census geocoder, USGS, or Postgres over
TCP. A laptop can, but so can **Cloudflare's network**, which is where the
Workers actually run.

So the shape is: GitHub Actions deploys the Workers, and the deployed Workers
do the fetching. The one thing neither can do is reach into Neon from here for
schema changes — that goes through the Neon connector in a session, which is
how the migration and the frost data were loaded.

## One-time setup — four secrets

All of it is clicking in two web UIs.

### 1. Cloudflare API token

Cloudflare dashboard → **My Profile** → **API Tokens** → **Create Token** →
use the **Edit Cloudflare Workers** template. Add these permissions if the
template does not already include them:

- Account → Workers Scripts → Edit
- Account → Workers KV Storage → Edit
- Account → Hyperdrive → Read

Copy the token. It is shown once.

### 2. Add it to GitHub

Repo → **Settings** → **Secrets and variables** → **Actions** → **New
repository secret**:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token from step 1 |
| `CLOUDFLARE_ACCOUNT_ID` | `f21c672256e6a090b3b7a3a0740be3ed` |
| `INGEST_RUN_TOKEN` | any long random string you invent |
| `INGEST_WORKER_URL` | filled in after the first deploy |

`INGEST_RUN_TOKEN` guards the manual run route. The ingest Worker has a public
URL once deployed, and without the token anyone could trigger a database write.
The route fails closed: with no token configured it refuses entirely, and with
a wrong token it returns 404 rather than confirming it exists.

### 3. Deploy

Actions tab → **Deploy** → **Run workflow**.

It typechecks, runs the tests, then deploys both Workers. The log prints each
Worker's URL. Copy the ingest one into the `INGEST_WORKER_URL` secret.

### 4. Load the reference data

Actions tab → **Run ingestion** → **Run workflow**.

This calls the deployed Worker, which fetches the hardiness zone file from
Oregon State's PRISM group and writes to
Neon through Hyperdrive. The log shows rows written and skipped per job, and
**fails the run if every job wrote zero rows** — a silent no-op is the failure
mode worth catching.

After that it runs itself monthly on the cron trigger in
`apps/ingest/wrangler.toml`.

## Checking the result

Ask in a session, and the Neon connector reports row counts, coverage gaps and
band ordering directly. Or run the standalone checks from anywhere that has a
Postgres connection:

```bash
DATABASE_URL="<neon dev string>" pnpm verify:data
```

## What still needs a session rather than CI

- **Schema migrations.** Generated from the Drizzle schema and applied through
  the Neon connector, deliberately — a migration should be a decision, not a
  side effect of a merge.

## Refreshing the ZIP list and weather stations

Actions tab -> **Refresh reference data** -> **Run workflow**.

It downloads the Census ZIP-to-county file and the NOAA 1991-2020 normals for
every Utah station in the market area, rebuilds `wasatch-zips.ts` and
`wasatch-frost.ts`, and opens a pull request. Review the station list, merge,
then run **Deploy** and **Run ingestion**.

The run summary shows which ZIPs were added and which stations were skipped
and why. In the repo settings, **Actions -> General -> Allow GitHub Actions to
create and approve pull requests** must be on, or the last step fails.
Pull requests opened this way do not start CI on their own; push an empty
commit from the GitHub UI or close and reopen it if you want the checks.

## What is already loaded

| Table | State |
|---|---|
| `climate_stations` | 1 — Salt Lake City International |
| `frost_norms` | 1 — real NCEI 1991–2020 normals |
| `data_provenance` | 1 |
| `hardiness_zones` | **0** — waiting on the first ingestion run |
| `plants` | **0** — curation has not started |
