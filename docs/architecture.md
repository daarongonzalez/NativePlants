# Architecture

Status: proposed, September 2026. Nothing here is built yet.

Read [data-sources.md](research/data-sources.md) first — the constraint that
external data sources cannot sit in the request path drives most of what
follows.

## Shape of the system

Four pieces, deliberately kept separate:

1. **Web app** — React and TypeScript, what gardeners and retailers see.
2. **API** — a single Worker, handles auth, site profiles, plans, and orders.
3. **Ingestion jobs** — scheduled work that pulls public data, normalizes it,
   and writes it to our database. Never touched by a user request.
4. **Recommendation engine** — a pure, testable module that takes a site
   profile and returns ranked plant candidates. No I/O, no framework.

Keeping the engine free of I/O matters more than it sounds. It is the part that
needs the most iteration and the most horticultural review, and it should be
runnable against a fixture file in a unit test.

## Stack

### Frontend: React Router v7, framework mode

Your React and TypeScript preference is right. On Cloudflare, React Router v7
is the better fit than Next.js — it has first-class, generally available
Cloudflare support, while Next.js needs an adapter layer (`@opennextjs/cloudflare`
or Cloudflare's `vinext`) that adds a moving part between you and your host.

Next.js is the safer call only if you already think in App Router and Server
Components. Otherwise React Router's loaders and actions are plain async
functions, which is a smaller thing to hold in your head.

### API: Hono on Cloudflare Workers

A note on Node: Workers is not Node. If the API must be Node, it belongs on
Cloud Run, Fly, or Railway — not Cloudflare. Since you have chosen Cloudflare
and own the domains there, Hono is the natural fit: tiny, TypeScript-first,
officially supported on Workers, and the routing model will feel familiar if
you have used Express.

Start with one Worker. Split it only when a real reason appears.

### Database: Neon Postgres with PostGIS, through Hyperdrive

- PostGIS is available on Neon with a single `CREATE EXTENSION`. We need it for
  soil map unit polygons, ecoregion boundaries, and nursery proximity search.
- Connect through **Cloudflare Hyperdrive**, which keeps warm connection pools
  at the edge. Two details from Cloudflare's own docs that are easy to get
  wrong:
  - Use the **direct** Neon connection string, not the pooled one. Hyperdrive
    does the pooling; doubling up causes problems.
  - Use `pg` (8.16.3 or newer) or `postgres.js`, **not** the Neon serverless
    driver, when going through Hyperdrive.
- Hyperdrive query caching defaults to a 60 second max age and does not
  invalidate on write. Turn caching **off** for anything user-specific — orders,
  profiles, inventory. Leave it on for the static reference tables, where it is
  a genuine win.
- Hyperdrive is on both the free and paid Workers plans, with no egress charge.

**ORM:** Drizzle. Runs on Workers, real TypeScript inference, and its migration
story is straightforward. Prisma's edge story has improved but carries more
weight than this project needs.

### Auth: Firebase, verified at the edge

Firebase Auth on the client is a reasonable choice — it hands you email,
Google, and phone sign-in without building any of it.

The catch: `firebase-admin` does not run on Workers, since it depends on Node
internals. Verify ID tokens instead with `firebase-auth-cloudflare-workers`, a
zero-dependency library built on Web Crypto, caching Google's public keys in
Workers KV.

**Roles.** You described two, and they behave very differently:

- `gardener` — owns sites, plans, and orders.
- `retailer` — owns a nursery, its inventory, and its orders. Effectively an
  admin over one tenant.
- `platform_admin` — us.

Put the role in a Firebase custom claim for fast routing decisions, but treat
**Postgres as the source of truth** for authorization. Custom claims live inside
an ID token and can be up to an hour stale, which is a long time to leave a
revoked retailer with write access to inventory.

Every retailer-scoped query needs an explicit `nursery_id` check in the query
itself. Do not rely on the client sending the right one.

### Storage: Cloudflare R2, not Google Cloud Storage

You mentioned possibly using Google for object storage. Since compute is on
Cloudflare, R2 is the better default: no egress fees, an S3-compatible API, and
direct bindings from a Worker with no cross-cloud credential handling.

Google earns its place later, if and when photo analysis becomes real — Vertex
AI is a good reason to put images where Google can reach them. That is a Phase 3
decision, not a today decision.

### Payments: Stripe Connect

Express accounts, so nurseries onboard themselves and Stripe carries the
compliance load. Baseline US card cost is 2.9% + 30¢, and our platform fee sits
on top of that. Model the margin before promising nurseries anything.

Worth deciding early: are we a marketplace that takes payment, or a referral
that hands the cart to the nursery? The first is a much better product and a
much heavier lift, including tax, refunds, and the fact that live plants are
perishable, seasonal inventory that dies.

### Scheduled work: Cron Triggers and Queues

Cloudflare Cron Triggers for the ingestion schedule, Queues for anything slow or
retry-prone, such as backfilling soil data for a new metro.

## Data flow, end to end

```
Public sources          Ingestion              Our database         Request path
--------------          ---------              ------------         ------------
USDA SDA / SSURGO  ->   scheduled Workers  ->  Neon + PostGIS   ->  Hono API  ->  React app
NOAA Normals            normalize, dedupe,     reference tables     recommendation
USDA hardiness zones    record provenance      + user tables        engine (pure)
GBIF / USDA PLANTS
NREL solar
```

Users only ever read the right-hand side. If an upstream source is down, the
product still works — it just gets slightly staler.

## The core domain object: the Site Profile

Everything hinges on this. A site profile is the resolved set of conditions for
one patch of ground:

- Location — lat/lon, resolved from address or a dropped pin
- Hardiness zone, and eventually heat zone and ecoregion
- Frost dates, with the 10/50/90 percent probability bands rather than one date
- Soil — pH, texture, drainage, organic matter, from SSURGO or a user-entered
  soil test
- Sun — computed from solar geometry, later refined by observation or photo
- Moisture, slope, and constraints the user tells us: deer, pets, kids, HOA
  rules, irrigation

Recommendation is then a matching problem: score each plant's tolerance ranges
against this profile, weight by the user's goals (pollinators, cut flowers,
vegetables, low water), and rank.

Build it as a transparent scoring function, not a model. Gardeners will ask
"why this plant?" and being able to answer plainly is a feature.

## A note on ZIP codes

ZIP codes are US Postal Service delivery routes, not geographic areas. Some are
a single building. They are fine for a first-touch "what zone am I in" lookup
and genuinely bad for soil, which varies within a block.

Plan: accept a ZIP for the fast path, geocode it to a centroid, and prompt for
an address or a map pin before doing anything soil-dependent. Be honest in the
interface about which answers are approximate.

## Risks worth naming now

- **Plant data curation is the long pole.** Not the code. Budget for it.
- **Advice carries liability.** Toxic-to-pets plants, invasive species,
  edible misidentification. Needs disclaimers and a review process.
- **Nursery inventory is messy.** Small nurseries often have no system at all.
  A CSV upload and a simple web form will outperform an API integration for a
  long time.
- **Seasonality.** Traffic will be sharply spiked around spring. Serverless
  handles that well, which is a point in Cloudflare's favor.
- **Scraping temptation.** The best native plant lists sit behind sites with no
  API. Partner or build; do not scrape.
