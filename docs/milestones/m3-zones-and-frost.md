# M3 — Zones and Frost

Status: ready to build. Depends on M1 (skeleton) and M2 (auth).

## What M3 is, in one sentence

**A gardener types their address and gets back their hardiness zone and their
frost probability bands, stored as a profile snapshot.**

No soil yet. No plants yet. It is the first milestone where the product tells
someone something true about their specific ground.

## Why this before soil

Soil is the harder job — SSURGO is a T-SQL research endpoint returning polygons
that need PostGIS. Zones and frost are small, stable, tabular datasets. Doing
them first proves the whole ingest-normalize-serve chain end to end against
something easy, so that when soil breaks, the pipeline is not also suspect.

## Deliverables

### 1. Geocoding

Address text in, coordinates out.

**Use the US Census Geocoder.** Public domain, no API key, no cost, and
US-only — which is exactly our scope. It also shares data lineage with the rest
of our federal sources.

Fallback if unavailable: Nominatim, respecting its usage policy. Do not reach
for a paid geocoder in V1.

Store the resolved coordinates **and the match quality** the geocoder returns.
A rooftop match and a street-interpolated match are different claims, and that
distinction belongs in the profile's provenance.

### 2. Ingestion job: hardiness zones

- Load a ZIP-to-zone table into `hardiness_zones` as a one-time job with an
  annual re-check.
- Store the ordinal (`8b` → `82`) so it sorts and compares correctly, alongside
  the temperature range.
- Write a `data_provenance` row citing the 2023 USDA revision.

### 3. Ingestion job: NOAA frost normals

- Load station geometry into `climate_stations` and the 10/50/90 probability
  thresholds into `frost_norms`.
- Scope to Utah plus a buffer — a Wasatch Front address may be nearest to a
  station across a county line.
- Period is 1991–2020. Store it, because it will change and old profiles need
  to say which normals they used.

### 4. The resolve endpoint

`POST /v1/sites/:id/resolve`

1. Geocode if the site has no coordinates
2. Look up the hardiness zone
3. Find the nearest climate station with `ST_DWithin` plus distance ordering
4. Write a new `site_profiles` row with zone, station, frost bands, and
   per-field provenance
5. Leave the soil fields null — they arrive in M4

The endpoint always writes a **new** snapshot and never updates an existing
profile. That is what makes a recommendation reproducible and lets us show
someone their profile has gone stale.

### 5. A screen, however plain

Address field, a resolve action, and the zone and frost bands rendered with the
attributed-value and frost-band components from the design system. Ugly is
fine. Wrong is not.

## The design decision M3 actually turns on

**Nearest station is not the same as representative station, and on the Wasatch
Front that gap is large.**

Elevation drives frost dates hard here. A valley-floor station near 4,200 ft
and a bench home at 5,200 ft can differ by around two weeks at each end of the
season. "Nearest" will confidently return the valley station and be
meaningfully wrong for a foothill address.

Handling:

- Compute the elevation difference between the site and the chosen station.
- Above a threshold — 150 m is a defensible starting point — drop that field's
  confidence from `high` to `medium` and record why in `confidence_notes`.
- Say it in the interface: *"The nearest weather station is 900 ft lower than
  your address, so your last frost is likely later than this."*

This is small to build and it is the product thesis in miniature. A competitor
filtering by ZIP code cannot say that sentence, and a gardener on the bench who
has lost a season to exactly this will trust us immediately.

It needs site elevation, which the Census geocoder does not return. Either a
USGS 3DEP point query at resolve time, or derive it from a DEM ingested
alongside the soil work in M4. For M3 the point query is fine — it is one call
on a user action, not on a page load.

## Definition of done

- Both ingestion jobs run on a schedule and are idempotent
- Every row they write has a `data_provenance` entry
- A Wasatch Front address resolves to a zone and frost bands in under two
  seconds
- Elevation mismatch lowers confidence and the interface says so
- The cross-account scoping suite passes against a real database — one gardener
  cannot resolve or read another's site
- Resolving twice produces two snapshot rows, not one updated row

## What M3 is not

- No soil. That is M4.
- No plant recommendations. That is M6.
- No sun modelling — solar geometry is cheap but belongs with the rest of the
  profile work in M4.
- Not pretty. The report screen is M5, and it gets real design time.
