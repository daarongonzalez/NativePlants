# Data Source Research

Status: draft, September 2026. Everything here needs a hands-on spike before we
commit to it.

## The finding that shapes the architecture

None of the good environmental data sources can be called live, per user, per
page load. They are slow, rate-limited, occasionally offline, and in one case
temporarily suspended. Some examples:

- SoilGrids fair-use policy is 5 API calls per minute, and ISRIC has the REST
  service paused with no restoration date.
- USDA Soil Data Access is a T-SQL query endpoint built for researchers, not
  for a consumer app's request path.
- NREL solar data requires a key and is metered.

So the platform is not an API proxy. It is an **ingest, normalize, and serve**
system. We pull these sources on our schedule, reshape them into our own
Postgres tables, and every user request reads only from our database. This
decision drives most of the architecture doc.

## Soil

### USDA NRCS Soil Data Access (SDA) — primary US source

- Endpoint: `https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest`
- POST a T-SQL query, get back JSON or XML. No API key.
- Backed by SSURGO, the detailed county-level soil survey. Also exposes
  STATSGO (coarser, full national coverage) as a fallback.
- Key tables: `mapunit`, `component`, `chorizon`. The useful fields for us live
  in `chorizon`: pH, organic matter, sand/silt/clay percent, available water
  capacity, plus drainage class on `component`.
- Also offers WMS/WFS for the map unit polygons, which we would want in PostGIS.
- Public domain as a US Government work.

**Caveat worth designing around:** SSURGO map units are far finer than a ZIP
code. A single ZIP can span several soil types. We should ask for an address or
a dropped pin, not just a ZIP, whenever soil accuracy matters.

### SoilGrids (ISRIC) — global fallback only

- Endpoint: `https://rest.isric.org/soilgrids/v2.0/properties/query`
- 250m global raster. Properties include pH, clay, sand, silt, organic carbon,
  bulk density, CEC across six depth bands.
- 5 calls per minute, and currently paused. Treat as a "someday, outside the
  US" option, not a launch dependency.

### What we still cannot get

Neither source tells a homeowner what is actually in *their* yard after decades
of construction fill, lawn treatment, and compaction. Long term, the honest
answer is a mail-in soil test partnership with a land-grant extension lab, and
a way for users to type in their own test results. Worth noting as a Phase 3
differentiator.

## Climate and hardiness

### USDA Plant Hardiness Zone Map (2023 revision)

- Official site is `planthardiness.ars.usda.gov`. No official API — USDA has an
  open GitHub issue asking for one that has sat unanswered for years.
- `phzmapi.org` is a community static API in the shape `{ZIP}.json`, built from
  PRISM data. Coverage is incomplete.
- An AWS Data Exchange dataset maps every USPS ZIP to a zone, updated monthly.
- `waldoj/frostline` is an open dataset plus parser covering the same ground.

**Recommendation:** ingest a ZIP-to-zone table once, store it ourselves, and
re-check it annually. This is a small, stable dataset. Do not call anyone's API
for it at request time.

### Frost dates and growing season

- NOAA NCEI US Climate Normals, 1991–2020 period, roughly 9,800–15,000
  stations. Includes freeze probability tables at the 10 / 50 / 90 percent
  levels, which is more useful than a single "last frost" date — we can show a
  gardener their risk tolerance rather than a false precision.
- Public domain. Bulk download and store.

### Hardiness zone is not enough

A zone is a single number: average annual minimum winter temperature. It says
nothing about summer heat, humidity, or rainfall. Phoenix and coastal San Diego
share zones with wildly different plant palettes. Two additions worth planning
for:

- **AHS Heat Zones** (days above 86°F) — licensing needs checking.
- **EPA Level III / IV Ecoregions** — public domain shapefiles. This is
  arguably a better organizing unit for "native" than any political boundary,
  and it is what serious native plant guidance already uses.

## Sun exposure

- NREL now serves from `developer.nlr.gov` — the old `developer.nrel.gov`
  domain retired in May 2026. Update any older tutorial code accordingly.
- NSRDB gives satellite-derived GHI, DNI, DHI by lat/lon. PVWatts v8 wraps it
  in a simpler model. Free with a key, metered.
- For sun *tracking* in a specific yard, the cheap first version is pure math:
  solar position by date, time, and lat/lon runs client-side with a library
  like SunCalc and needs no API at all.
- Real shade modeling needs building and tree canopy geometry, which is the
  hard part of the photo-analysis feature. Park it.

## Plant data — the real problem

This is where the project will spend most of its effort, and where every
existing free option falls short.

| Source | Verdict |
|---|---|
| USDA PLANTS | Public domain, authoritative taxonomy and native/introduced status by state. No official API; third-party wrappers like `plantsdb.xyz` exist but are unofficial. Thin on horticulture. |
| GBIF | Excellent API, real occurrence records, and a `establishmentMeans` field with values like native / introduced / vagrant. Licensing is per-dataset (CC0, CC-BY, CC-BY-NC) — must be tracked per record. |
| Trefle | Aggregates USDA, GBIF, and OpenFarm. Long dormant. Do not build on it. |
| Perenual | Commercial freemium, ~10,000 species with watering, sunlight, and pest data. Useful as a paid enrichment layer, not a foundation. |
| NWF Native Plant Finder | ZIP-level lists ranked by caterpillar host value, based on Doug Tallamy's research. No API. Scraping is a legal and reputational risk. |
| Audubon Plants for Birds | ZIP-level lists tied to bird species. No API. |
| Lady Bird Johnson Wildflower Center | The best North American native plant reference, 25,000+ species. No API. |

**The gap:** no free source combines taxonomy, native range, and practical
growing conditions (soil pH tolerance, moisture, light, mature size, bloom
window, wildlife value) in one place. Everyone building in this space hits the
same wall.

**The recommendation, and the honest cost:** build our own curated plant table.
Seed the taxonomic and native-range skeleton from USDA PLANTS and GBIF, both
usable. Then fill in the horticultural attributes by hand, region by region,
starting with a few hundred species for one or two launch metros rather than
thin coverage everywhere. That curation is slow and unglamorous. It is also the
only durable moat this product has — the software is copyable, the curated
regional plant data is not.

For the partnership angle, several of the organizations above license their
data. A conversation with the Wildflower Center is likely cheaper than
rebuilding what they spent decades on.

## Licensing summary

- USDA, NOAA, NREL, EPA: US Government works, public domain. Safe.
- GBIF: per-dataset. Store the license and citation with every record.
- Perenual: commercial terms, read before depending on it.
- NWF, Audubon, Wildflower Center: no public API. Partner or leave alone.

## Competitive read

The existing free tools each answer one narrow question — which plants feed
local birds, which feed local caterpillars, what is native to my county. All of
them stop at the list. None of them look at the gardener's actual soil, lay out
a bed, sequence the planting across a season, or connect the plan to a nursery
that has the plants in stock this weekend.

That whole-workflow gap, ending in a real purchase from a real local grower, is
the opening.

## Sources

- [Soil Data Access web service help](https://sdmdataaccess.nrcs.usda.gov/WebServiceHelp.aspx)
- [SSURGO overview, NRCS](https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-database-ssurgo)
- [SSURGO access notes, ncss-tech](http://ncss-tech.github.io/misc/soil-data-sources/ssurgo.html)
- [SoilGrids REST API](https://rest.isric.org/)
- [SoilGrids, ISRIC](https://isric.org/explore/soilgrids)
- [2023 USDA Plant Hardiness Zone Map](https://planthardiness.ars.usda.gov/)
- [USDA-APIs issue #40, hardiness zone API request](https://github.com/USDA/USDA-APIs/issues/40)
- [frostline dataset and parser](https://github.com/waldoj/frostline)
- [NSRDB Data Downloads API](https://developer.nrel.gov/docs/solar/nsrdb/)
- [PVWatts V8 API](https://developer.nrel.gov/docs/solar/pvwatts/v8/)
- [GBIF API reference](https://techdocs.gbif.org/en/openapi/)
- [Discerning species as native or introduced, GBIF forum](https://discourse.gbif.org/t/discerning-species-as-native-introduced-or-invasive/4447)
- [Trefle API](https://trefle.io/)
- [Perenual API docs](https://perenual.com/docs/api)
- [plantr, USDA PLANTS API wrapper](https://mikemahoney218.github.io/plantr/)
- [NWF Native Plant Finder](https://nativeplantfinder.nwf.org/about)
- [Audubon Native Plants](https://www.audubon.org/native-plants)
- [Lady Bird Johnson Wildflower Center plant database](https://www.wildflower.org/plants/)
