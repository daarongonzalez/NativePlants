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

## Not verified yet

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

## What still blocks recommendations

The plants route needs a complete profile. Two pieces are missing, and the
route says so rather than guessing:

- **Frost bands** are not joined onto the stored profile yet (only the station
  id is stored).
- **Sun hours** are not built. The plan is solar geometry from latitude, marked
  as modelled.

## Next

1. Run the three checks above.
2. Have the horticultural reviewer start on the sheet (see the curation guide).
3. Join frost bands and add sun hours, which unblocks the recommendation list.
