# M4 and M6 start: soil and the plant list

Status: code written, not yet run against real data. October 2026.

## What was built

**Soil (M4)**

- A client for USDA Soil Data Access, the query service in front of the county
  soil survey (`packages/sources/src/soil.ts`).
- An ingestion job that loads map unit shapes and soil layers for the four
  launch counties (`apps/ingest/src/soil.ts`). Run it from **Actions → Run
  ingestion**, choosing `soil`. It is not part of the monthly run because it is
  large, and the survey changes about once a year.
- A lookup that finds the map unit under an address, and an average of its top
  12 inches (`packages/engine/src/soil.ts`).
- The resolve step now fills pH, sand, silt, clay and drainage, each with its
  source and confidence. Soil is never "high" confidence: a survey map unit is
  an area average, not a sample from the yard.
- When the survey has nothing for an address (water, or built-up land it does
  not measure), the profile says so and suggests a home soil test. It does not
  invent a value.

**Plants (start of M6)**

- The curation sheet lives at `data/plants/wasatch-plants.csv`. It has headers
  and no rows yet. See [Plant curation](../plant-curation.md).
- An importer that checks every row and loads nothing if any row is wrong
  (`POST /__run?job=plants`, or choose `plants` in the workflow).
- `data/plants/candidates.csv` lists 33 species worth considering. **These are
  starting suggestions only.** Names and families have not been checked by a
  reviewer, and no tolerances have been filled in.

**A fix on the way through.** The plant recommendations route was reading a
placeholder confidence for every field. It now uses what was recorded when the
profile was resolved, and says which fields are missing when the profile is
incomplete.

## First soil load, 24 October 2026 (dev branch)

| Survey area | Map units | With soil layers |
|---|---|---|
| UT607 Davis-Weber Area | 178 | 156 |
| UT612 Salt Lake Area | 150 | 132 |
| UT621 Utah County, Central Part | 143 | 139 |

2,124 soil layers loaded. Average topsoil pH is 7.9, which is right for the
Wasatch Front, and every unit that has layers has a drainage class. One
provenance row per survey area.

Spot checks of 18 places across the four counties: 17 landed in a map unit.
Findings:

- **Self-intersecting outlines.** 6 of 471 shapes were invalid, and they are
  common valley soils (Chipman, Taylorsville). They were repaired on dev, and
  the load now repairs every shape as it goes.
- **Urban land.** Downtown Salt Lake City, Ogden, Bountiful and Provo fall in
  "Urban land", which the survey does not measure. Those addresses get the
  honest "soil test recommended" message rather than a number. Roughly a tenth
  of units are like this.
- **Coverage gap.** Eden, in Ogden Valley, is in no loaded survey area. The name
  search found three areas; there may be others for eastern Weber County and
  parts of Utah County. The Live source check now lists every Utah survey area
  so the missing ones can be named.

## Verified and not verified

The build environment cannot reach the soil service, so the first real
response is the first test of the field names, exactly as with Census and USGS.

1. Run **Live source check**. It now includes three soil checks and prints the
   raw responses, including which survey areas the name search finds.
2. Merge, run **Deploy**, then **Run ingestion** with `soil`. Read the output:
   it lists the survey areas it found, and any map units that had no shapes.
3. Spot-check three addresses by hand against the
   [Web Soil Survey](https://websoilsurvey.nrcs.usda.gov/).

Things most likely to need adjusting after the first run:

- **Survey area names.** The job finds areas by name prefix (Salt Lake, Utah
  County, Davis, Weber). If a name differs, the output shows what was found.
- **Time and size.** A Worker request has limits. If the run times out, the
  fix is to run one survey area per request.
- **Shape size.** Shapes are stored unsimplified. If the table is slow, simplify
  on load.

## Frost dates and sun hours

Both now reach the plant recommendations route.

| | Built in | Stored in | Served by |
|---|---|---|---|
| Frost dates | Loaded from NOAA by the ingest Worker (already done) | `frost_norms` table in Neon; the profile stores which station applies | API Worker joins them when recommending |
| Sun hours | `packages/engine/src/sun.ts`, calculated when a site is resolved | `site_profiles.sun_hours_summer` in Neon, with its source in the profile's provenance | API Worker: `POST /v1/sites/:id/resolve`, then `GET /v1/sites/:id/plants` |

- **Frost** needed no new data. The route looks up the saved station's normals
  and passes them to the scorer.
- **Sun** is calculated from latitude and marked as modelled, low confidence,
  until the gardener answers the sun question. Their answer replaces it and is
  marked as reported by them.
- **The sun question** is saved on the site (`sites.sun_exposure`) with
  `PUT /v1/sites/:id/sun` and `{"sunExposure": "full" | "part" | "shade" | null}`.
  Resolve uses the saved answer, so it survives a refresh. Resolve also accepts
  a one-off answer in its body, which wins over the saved one. The wording the
  screen shows is in `packages/shared/src/sun-question.ts`.
- **Order matters on release.** The new column must exist before the API is
  deployed, or reading a site fails. Apply migration `0001_add_site_sun_exposure`
  to the Neon branch first (`pnpm db:migrate`), then run Deploy.

Everything runs in the two Cloudflare Workers against the Neon database. Nothing
new to deploy or provision.

## Next

1. Run the three checks above.
2. Have the horticultural reviewer start on the sheet (see the curation guide).
3. Fill the plant sheet with Rachel, then run the `plants` load.
4. Build the screen that shows the sun question. The wording and the save route are ready.
