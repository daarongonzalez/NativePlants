# Backend Setup Runbook

Three steps to take the backend from "code exists" to "working end to end".
Each has to happen on a machine with normal network access — the environment
this code was written in blocks the hosts involved.

Work them in order. Step 2 needs step 1, step 3 needs step 2.

---

## Step 1 — Provision and wire, roughly 30 minutes

Goal: a deployed Worker that answers `/v1/health` and can reach Postgres.

### 1a. Get the direct Neon connection string

Hyperdrive needs the **direct** string, not the pooled one. In the Neon console,
open the `dev` branch and toggle **Connection pooling off** — or take the pooled
string and delete `-pooler` from the host.

```
# pooled   ep-wild-poetry-aexcp5tj-pooler.c-2.us-east-2.aws.neon.tech
# direct   ep-wild-poetry-aexcp5tj.c-2.us-east-2.aws.neon.tech
```

Hyperdrive does the pooling. Pointing it at Neon's pooler stacks two poolers
and causes problems that surface under load rather than immediately.

### 1b. Create the Cloudflare resources

```bash
npx wrangler login

npx wrangler hyperdrive create nativeplants-db \
  --connection-string="postgresql://neondb_owner:<password>@ep-wild-poetry-aexcp5tj.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

npx wrangler kv namespace create AUTH_KEYS
```

Both print an id. Keep them.

### 1c. Firebase project

Create one if it does not exist. Enable **Email/Password** and **Google**
sign-in. Copy the project id.

No service account key is needed anywhere — `firebase-admin` does not run on
Workers and we do not use it. The API verifies tokens against Google's
published keys, which is why it needs only the project id.

### 1d. Fill in the config

`apps/api/wrangler.toml`:

```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<hyperdrive id from 1b>"

[[kv_namespaces]]
binding = "AUTH_KEYS"
id = "<kv id from 1b>"

[vars]
FIREBASE_PROJECT_ID = "<your firebase project id>"
MARKET = "wasatch-front"
```

`apps/ingest/wrangler.toml` needs the same Hyperdrive id. It does not need KV —
ingestion never authenticates a user.

### 1e. Confirm it works

```bash
pnpm --filter @np/api dev
curl http://localhost:8787/v1/health
# {"ok":true,"market":"wasatch-front"}
```

**Done when:** `/v1/health` answers and a `wrangler deploy` succeeds.

---

## Step 2 — Load real reference data, half a day

Goal: the resolve endpoint returns real zones and real frost dates.

This is the step with actual work in it. The other two are configuration.

### 2a. Replace the frost placeholder

`apps/ingest/src/data/wasatch-frost.ts` currently holds **one station with
unsourced values** and a header notice saying so. Shipping it would make the
provenance row cite NOAA for numbers NOAA never produced.

- Source: NOAA NCEI **US Climate Normals, 1991–2020**, the
  **freeze/frost probability** product — a different product from the daily
  normals, and the one carrying the 10/50/90 percent thresholds.
- Filter to Utah stations covering Salt Lake, Utah, Davis and Weber counties.
- Parse into the `FrostRecord` shape in `apps/ingest/src/frost.ts`. Keep the
  10/50/90 columns in that order — mislabelling them produces advice that is
  exactly backwards, which is what the format tests guard against.
- Every station needs an elevation. The whole confidence rule depends on it,
  and a null elevation silently drops that field to medium confidence.
- Hand-check one station against a published source before loading.
- Delete the placeholder notice.

### 2b. Expand the ZIP list

`apps/ingest/src/wasatch-zips.ts` is a starting set, not complete. A missing
ZIP tells a real gardener we do not cover an address we do intend to cover.

Fill it from a Census ZCTA list for the four counties.

### 2c. Run the jobs

```bash
pnpm --filter @np/ingest dev
curl -X POST http://localhost:8787/__run
```

The response reports rows written and skipped per job, plus warnings. A job
that wrote zero rows logs a warning rather than passing quietly — read the
output rather than assuming.

### 2d. Verify the tables

```sql
SELECT count(*) FROM hardiness_zones;          -- expect ~70+
SELECT count(*) FROM climate_stations;          -- expect several
SELECT count(*) FROM frost_norms;
SELECT count(*) FROM data_provenance;           -- one per ingested row
SELECT DISTINCT zone_ordinal FROM hardiness_zones ORDER BY 1;
```

Zone ordinals on the Wasatch Front should cluster around 61–72 (zones 6a–7b).
Anything outside that range means a parsing problem, not a surprising climate.

**Done when:** `POST /v1/sites/:id/resolve` on a real Salt Lake address returns
a zone and frost bands that match what you would find by hand.

---

## Step 3 — Verify, roughly an hour

Goal: stop trusting code that has never met a live response.

### 3a. Run the database integration tests

These have never run. Thirteen tests covering cross-account scoping and the
PostGIS queries.

```bash
export TEST_DATABASE_URL="<neon dev pooled string>"
pnpm --filter @np/db test
```

The pooled string is correct here — these connect with `pg` directly, not
through Hyperdrive.

**A skip is not a pass.** If the suite reports "13 skipped", the environment
variable did not reach it and nothing about authorization has been proven.

### 3b. Make one live call to each source client

The Census and USGS parsers were written to documented shapes and have never
seen a real response. Field paths are the risk.

```bash
curl "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=1745+E+Sunnyside+Ave,+Salt+Lake+City,+UT&benchmark=Public_AR_Current&format=json"

curl "https://epqs.nationalmap.gov/v1/json?x=-111.891&y=40.7608&units=Meters&wkid=4326"
```

Compare against the fixtures in `packages/sources/src/geocode.test.ts` and
`elevation.test.ts`. If the shapes differ, fix the parser **and** update the
fixture so the test still means something.

### 3c. Apply the schema to production

Production is still empty. Do it deliberately rather than as a side effect:

```bash
export DATABASE_URL="<neon PRODUCTION direct string>"
pnpm db:migrate
```

Then enable PostGIS on that branch first if it is not already:
`CREATE EXTENSION IF NOT EXISTS postgis;`

**Done when:** 61 tests pass rather than 48, both parsers are confirmed against
live responses, and production carries the schema.

---

## After these three

The backend works. What is missing is anything a gardener can open — `apps/web`
does not exist yet. That is M5, and it is where the design system finally gets
used.

## Housekeeping

The `dev` branch connection string was read during the M3 build and is in that
session's transcript. Nothing was committed and it is dev-only, but rotating
the `neondb_owner` password is cheap if you would rather not rely on that.
