# V1 Specification

Status: proposed, September 2026. One open blocker, noted at the end.

## What V1 is

**An address in, the truth about that ground out, and a short list of plants
that will actually live there.**

One metro. Roughly 60–100 curated species. No layout, no visualization, no
nurseries, no payments. It should take a gardener under two minutes to get an
answer they could not get anywhere else.

### Explicitly out of scope

Naming these now prevents the slow creep that kills a V1.

- Garden layout, bed drawing, or any visualization of the yard
- Photo upload or analysis
- Nursery accounts, inventory, or checkout
- Payments and subscription billing
- Native mobile apps
- Anything outside the launch metro
- AI chat

### The one thing V1 must do well

Competitors win the first impression with a photo-realistic render. We cannot
match that in V1 and should not try. What we can do is make the **site profile
itself the memorable artifact** — a soil-horizon report that looks like
something a soil scientist handed you, not a table of numbers. That is the
screenshot people share. Budget real design time for it.

## Platform decisions

### Cloudflare covers most of the backend, with two exceptions

| Concern | Choice |
|---|---|
| Compute | Cloudflare Workers |
| Scheduled jobs | Cron Triggers + Queues |
| Object storage | Cloudflare R2 |
| Edge cache | Workers KV |
| Security, WAF, rate limiting, bot defense | Cloudflare |
| DB connection pooling | Cloudflare Hyperdrive |
| **Database** | **Neon Postgres + PostGIS — not D1** |
| **Identity** | **Firebase Auth — not Cloudflare Access** |

**Why not D1.** It is SQLite. No row-level security, no PostGIS, no trig
functions (so even a Haversine distance query needs a workaround), and a hard
10 GB per-database cap. This product is spatial from end to end.

**Why not Cloudflare Access.** It is a Zero Trust product for employees and
internal applications. Cloudflare-as-identity-provider authenticates people who
hold Cloudflare accounts. Neither is a consumer signup flow.

### Authorization: explicit scoping first, RLS second

Neon supports Postgres RLS, and Neon RLS binds JWT claims to policies through
the `pg_session_jwt` extension. It works, and it is a trap if rushed.

Hyperdrive pools connections. A session variable set with `SET` outlives its
transaction and leaks into whatever request borrows that connection next.
In a multi-tenant app that means one account reading another's rows.

**V1 approach, in order:**

1. Every query goes through a repository function that takes an explicit owner
   id. No ad-hoc queries in route handlers.
2. A test suite that attempts cross-account reads on every table and expects
   zero rows.
3. RLS added afterward as defense in depth, with context set via `SET LOCAL`
   inside an explicit transaction, never `SET`.

Tested application scoping beats RLS that silently leaks. Do both, in that
order, and never rely on step three alone.

### Auth: stay with Firebase for V1

It is a decision already made, it is the fastest path to a working login, and
swapping later is annoying but bounded.

- `firebase-admin` does not run on Workers. Verify ID tokens with a Web Crypto
  library and cache Google's public keys in KV.
- Postgres is the source of truth for roles. A Firebase custom claim can be an
  hour stale.
- On first sign-in, create a local `users` row keyed by the Firebase UID. All
  application data references the local id, never the Firebase UID directly.
  This is what keeps the auth provider swappable.

**Revisit at Phase 2** if the Firebase-to-Postgres sync becomes friction.
Better Auth runs on Workers with Drizzle and Hyperdrive and keeps the user table
in your own database, which makes scoping and RLS simpler. The tradeoff is that
you operate it. Not a V1 decision.

## Architecture

Four packages, kept separate from day one.

```
apps/web        React Router v7, deployed to Workers
apps/api        Hono, deployed to Workers
apps/ingest     Scheduled Workers — cron + queue consumers
packages/engine Scoring. Pure functions, zero I/O, zero framework
packages/db     Drizzle schema, migrations, repository functions
packages/shared Types and zod schemas used across the above
```

The engine has no database import. It takes a site profile and a plant array,
returns a ranked array. That constraint is what lets a horticulturist review its
output against a fixture file without running the application.

## Data model

Abbreviated. Full definitions live in the Drizzle schema.

### Reference tables — written only by ingestion

```
hardiness_zones     zip, zone, temp_min_f, temp_max_f, source_year
climate_stations    id, name, geom(Point), elevation_m
frost_norms         station_id, last_spring_p10/p50/p90, first_fall_p10/p50/p90,
                    frost_free_days, normals_period
soil_map_units      mukey, geom(MultiPolygon), survey_area, name
soil_properties     mukey, depth_top_cm, depth_bottom_cm, ph, sand_pct, silt_pct,
                    clay_pct, organic_matter_pct, awc, drainage_class
plants              id, scientific_name, common_names[], family,
                    ph_min, ph_max, sun_min, sun_max, moisture_min, moisture_max,
                    zone_min, zone_max, mature_height_cm, mature_width_cm,
                    bloom_start_month, bloom_end_month, bloom_color,
                    native_status, wildlife_value, toxicity_notes,
                    curated_by, curated_at, review_status
plant_media         plant_id, r2_key, credit, license, source_url
data_provenance     table_name, record_id, source, license, retrieved_at, citation
```

`data_provenance` is not optional. GBIF licenses vary per dataset, and we need
to answer "where did this claim come from" for any row in the system.

### User tables

```
users               id, firebase_uid, email, created_at, role
sites               id, user_id, label, geom(Point), address_text, created_at
site_profiles       id, site_id, resolved_at, zone, frost_station_id, mukey,
                    ph, sand_pct, silt_pct, clay_pct, drainage_class,
                    sun_hours_summer, confidence_notes jsonb
site_constraints    site_id, deer, pets, kids, irrigation, hoa_notes
saved_plants        user_id, site_id, plant_id, created_at
```

A `site_profile` is a **snapshot**, not a live view. It records what we knew
when it was resolved. That makes results reproducible and lets us show a
gardener that their profile is six months stale.

## Ingestion jobs

Build in this order. Each is independently useful and independently testable.

1. **Hardiness zones.** One-time load of a ZIP-to-zone table, re-checked
   annually. Smallest possible first job; proves the whole pipeline.
2. **Frost normals.** NOAA NCEI 1991–2020, station geometry plus the 10/50/90
   probability bands. Annual refresh at most.
3. **Soil.** SSURGO via Soil Data Access, scoped to the launch metro's counties
   only. Map unit polygons into PostGIS, horizon properties into
   `soil_properties`. This is the largest job — run it through a queue.
4. **Plants.** An importer that reads a curation spreadsheet and upserts into
   `plants`. Not an API pull. See the curation workflow below.

All four write `data_provenance` rows. None are ever called from the request
path.

## The scoring function

```
score(profile: SiteProfile, plant: Plant, goals: Goals) -> Score
```

Deterministic, transparent, and explainable. Not a model.

**Hard filters — a plant fails outright:**
- Hardiness zone outside `zone_min .. zone_max`
- Soil pH outside `ph_min .. ph_max` by more than a configurable tolerance

**Weighted fit — each returns 0 to 1:**
- pH distance from the plant's optimum
- Drainage class match
- Sun hours against the plant's range
- Moisture against the plant's range
- Mature size against available space, when the user provides it

**Goal weighting.** The user's selected goals (pollinators, low water, deer
resistant, cut flowers, edible) reweight the components rather than filtering.

**Every result carries its reason.** The engine returns the component scores
that drove the ranking, and the interface renders them in plain language:
*"thrives at your pH 6.2, tolerates your clay drainage, wants more sun than your
north bed gets."* If we cannot explain a recommendation, we do not show it.

**Testing.** A fixture set of at least 20 hand-checked profile-plus-plant pairs
with expected outcomes, reviewed by the horticultural advisor. This file is the
contract between the software and the horticulture.

## API surface

```
POST   /v1/sites                  create a site from an address
GET    /v1/sites                  list the caller's sites
GET    /v1/sites/:id              site with its current profile
POST   /v1/sites/:id/resolve      build or refresh the site profile
PATCH  /v1/sites/:id/constraints  deer, pets, irrigation, etc.
GET    /v1/sites/:id/plants       ranked recommendations, with reasons
POST   /v1/sites/:id/saved        save a plant to the site
DELETE /v1/sites/:id/saved/:pid   remove it
GET    /v1/plants/:id             plant detail
GET    /v1/health                 liveness
```

All routes except `/v1/health` require a verified Firebase ID token. Every
handler resolves the local user id from the token and passes it explicitly into
the repository layer.

## Screens

1. **Landing.** What this is, one honest sentence, and an address field. No
   signup wall in front of the first answer.
2. **Address confirm.** A map pin they can drag. Soil varies within a block, and
   a ZIP centroid is not good enough — say so here, briefly.
3. **Site profile.** The hero artifact. Soil horizon visualization, pH, texture
   triangle, drainage, zone, frost bands as a range rather than a date. Every
   value carries its source and confidence.
4. **Constraints.** Five or six questions, skippable.
5. **Recommendations.** Ranked plant cards, each with its reason. Filter chips
   for the goals.
6. **Plant detail.** Photo, tolerance ranges shown against *this* site's values,
   bloom window, wildlife value, toxicity warning where it applies.
7. **Saved list.** Printable. This is what a gardener takes to a nursery, and in
   V1 it is the manual stand-in for the commerce phase.

Sign-in is required only to save. Everything before that is open — it is the
fastest way to learn whether the advice is any good.

## Assets to create

The code is the part that gets tracked by default. These are the ones that get
forgotten and then block a launch.

### Accounts and infrastructure
- [ ] Cloudflare account, Workers Paid plan, DNS for the owned domains
- [ ] R2 bucket for plant media, with a public read path
- [ ] KV namespaces: JWKS cache, zone lookups
- [ ] Hyperdrive config pointing at Neon's **direct** connection string
- [ ] Neon project with separate dev and production branches
- [ ] Firebase project, email plus Google sign-in enabled
- [ ] GitHub repo with Actions for lint, typecheck, test, and deploy
- [ ] Error tracking (Sentry or equivalent) wired into both Workers
- [ ] Staging and production environments, separated from the first deploy

### Code
- [ ] Monorepo scaffold with the six packages above
- [ ] Drizzle schema and the initial migration
- [ ] Repository layer with enforced owner scoping
- [ ] Cross-account access test suite
- [ ] Four ingestion jobs
- [ ] Scoring engine plus its fixture file
- [ ] Hono API with Firebase token verification middleware
- [ ] React Router app, seven screens
- [ ] Seed script that loads a working dev database in one command

### Data
- [ ] ZIP-to-hardiness-zone table
- [ ] Frost normals table for the launch region
- [ ] SSURGO extract for the launch counties
- [ ] **The curation spreadsheet** — 60 to 100 species with every tolerance
      range filled in, and a named reviewer
- [ ] **Plant photography with licensing sorted.** This is a real asset and it
      is easy to underestimate. Options are iNaturalist and Wikimedia Commons
      under CC licenses, which require attribution stored per image, or
      commissioning photography. Competitors have photographed libraries;
      placeholder images will read as unfinished.
- [ ] Data provenance and licensing register

### Design
- [ ] Name, wordmark, palette, type scale
- [ ] The site profile report — the differentiating visual, worth real time
- [ ] Plant card component
- [ ] Empty, loading, and error states for every screen
- [ ] Mobile layouts; a gardener uses this standing in the yard

### Content
- [ ] Plain-language explainers: pH, soil texture, drainage class, frost
      probability bands. This is the education layer, and it is also the SEO
      surface.
- [ ] Onboarding copy
- [ ] **Advice disclaimer.** Toxic-to-pets plants and invasive species carry
      real liability. Needs review before launch, not after.
- [ ] Privacy policy and terms of service. Required — we collect home addresses.

### Operations
- [ ] Horticultural reviewer engaged, with their name on the plant data
- [ ] Backup and restore procedure, tested once
- [ ] A written definition of what "the profile is wrong" means, and how a user
      reports it

## Build order

Each milestone ends with something running in a browser.

- **M1 — Skeleton.** Monorepo, both Workers deployed, Neon connected through
  Hyperdrive, one route reading one row, CI green. Nothing user-facing.
- **M2 — Auth.** Sign in, a `users` row created on first sign-in, a protected
  route, and the cross-account test suite passing against a stub table.
- **M3 — Zones and frost.** First two ingestion jobs. An address returns a zone
  and frost bands. Ugly but real.
- **M4 — Soil.** SSURGO ingested for the launch counties. The site profile is
  now complete and the resolve endpoint works end to end.
- **M5 — The report screen.** Design investment lands here. This is the first
  demoable moment.
- **M6 — Plants.** Curation spreadsheet imported, scoring engine built against
  fixtures, recommendations rendering with reasons.
- **M7 — Polish and launch.** Saved lists, printable output, disclaimers,
  policies, error states, mobile.

M1 through M3 are mostly mechanical. M4 and M6 carry the real risk — SSURGO is
awkward to query, and curation is slow. Sequence any help you bring in around
those two.

## Definition of done

V1 ships when a gardener in the launch metro can type an address and get a soil
and climate profile plus a ranked plant list with reasons, on a phone, in under
two minutes, without signing up.

### What to measure from day one

- Did they get to a profile? Where do they drop?
- Did they save anything? Saving is the first real signal of value.
- Which recommendations get saved, and which get ignored?
- Reported profile errors, per metro. This is the data that improves the
  product and nobody else is collecting it.

## The open blocker

**Which metro.** It decides which counties to ingest, which species to curate,
which reviewer to approach, and which nurseries to call in Phase 4. Everything
in M4 and M6 waits on it.

Pick it on two criteria: soil survey coverage quality, and whether you can get
nursery owners in a room. The second matters more — the data is public
everywhere, the relationships are not.
