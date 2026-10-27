# M4 and M6 start: soil and the plant list

Status: soil loaded and checked on the dev database; plant path tested, plant sheet empty. 26 October 2026.

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

## Soil load, 24 October 2026 (dev branch)

Nine survey areas, loaded by symbol in slices. Every area has its source citation.

| Survey area | Map units | With soil layers | Soil layers |
|---|---|---|---|
| UT607 Davis-Weber | 178 | 156 | 763 |
| UT608 Fairfield-Nephi (Cedar Valley) | 224 | 200 | 1,172 |
| UT609 Morgan (incl. Ogden Valley) | 146 | 143 | 594 |
| UT611 Tooele (part of Davis County) | 89 | 83 | 273 |
| UT612 Salt Lake | 150 | 132 | 687 |
| UT613 Summit (part of Salt Lake County) | 84 | 78 | 438 |
| UT621 Utah County, Central | 143 | 139 | 674 |
| UT622 Heber Valley (part of Utah County) | 151 | 147 | 668 |
| UT627 Sanpete Valley (part of Utah County) | 194 | 188 | 784 |
| **Total** | **1,359** | **1,266** | **6,053** |

No invalid or empty shapes. About 50 MB of outlines. Average topsoil pH on the
first three areas was 7.9, as expected for the Wasatch Front.

**Spot checks.** 20 places across the four counties, all inside a map unit,
including Eden and Huntsville (Ogden Valley), Eagle Mountain, Payson, Santaquin,
Alpine, Emigration Canyon and Cottonwood Heights, each with measured layers.
Downtown Salt Lake City, Ogden, Bountiful and Provo fall in "Urban land", which
the survey does not measure, so those addresses get the "soil test
recommended" message. Roughly a tenth of units are like this. A point on the
Utah Lake shore (Saratoga Springs) fell in "Water".

### What went wrong on the way, and the fixes

| Load | Problem | Fix |
|---|---|---|
| First | 6 of 471 outlines were self-intersecting | Repaired as they are written |
| First | Ogden Valley (Eden) in no loaded area; the name search found three | Load by area symbol (nine) |
| Second | HTTP 502 after about 100 seconds: one request cannot run that long | Load in slices of about a minute, following a cursor |
| Second | The workflow failed instantly on a URL stored without `https://` | The workflow adds the scheme |
| Third | Cloudflare error 1102 (out of memory) on mountain and forest areas, whose outlines run to tens of megabytes per batch | 10 units per batch, outlines simplified by about 3 m at the source, retries with 5, 2, then 1 unit; the area keeps the size that worked |

## Plant path, tested

The importer's database write had never been tested, only the sheet parsing. Two
tests now cover it:

- **Database test** (runs in CI on PostGIS): sheet text goes in, one draft and
  one published plant are stored, only the published one is served, every stored
  row passes the same schema the API uses, and importing the sheet again with one
  change updates in place rather than duplicating.
- **Engine test**: sheet text goes through the importer's parser and into the
  scoring engine. An acid-loving shade plant is ruled out with the right reason, a
  sun lover outranks a part-shade plant on an unshaded yard, and the part-shade
  plant moves to first once the gardener says the spot gets part sun.

The plants in those tests are invented to exercise the rules and are not
horticultural claims. The real sheet is still empty, so running **Run ingestion**
with `plants` today reports "no rows yet" and fails on purpose. That confirms the
route and the token work, nothing more.

## Still to verify

- **Against the Web Soil Survey.** The loaded values match the service we read
  from, but nobody has compared three real addresses with the
  [Web Soil Survey](https://websoilsurvey.nrcs.usda.gov/) by hand. Worth doing
  once, with an address whose soil the gardener already knows.
- **Simplified outlines.** Shapes are simplified by about 3 m. A spot check near a
  boundary between two soil types would confirm that is invisible in practice.
- **End to end through the deployed API.** Nobody has resolved a real address
  through the live Workers, because that needs sign-in. It happens with the web
  app.
- **Production.** The schema is there, the data is not. The Hyperdrive config
  still points at dev. Before launch: point it at production and run reference,
  `soil` and `plants` loads there.

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
