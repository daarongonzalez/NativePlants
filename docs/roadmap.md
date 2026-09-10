# Roadmap

Status: proposed, September 2026.

The organizing principle: **go deep in one metro before going wide.** A tool
that gives excellent advice in Austin beats one that gives shallow advice
everywhere, and the second is what every existing free tool already does.

## Phase 0 — Decide and scaffold

- Pick the launch metro. Choose it for data quality and for nursery
  relationships you can actually get in a room.
- Stand up the monorepo, the Neon project, and the Cloudflare account wiring.
- One vertical slice end to end: sign in, save a location, read one row from
  Postgres through Hyperdrive. Proves the whole chain before it grows.

## Phase 1 — The site profile

The smallest thing that is genuinely useful and that nobody else does well.

- Firebase sign-in for gardeners.
- Address or pin-drop, geocoded.
- Hardiness zone from our own ingested table.
- Frost dates with probability bands from NOAA normals.
- Soil from SSURGO: pH, texture, drainage.
- A clean summary screen: *here is what your ground is actually like.*

Ships without any plant recommendations at all. Still worth using.

## Phase 2 — Recommendations

- Curated plant table for the launch region. Start with a few hundred species,
  not thousands.
- The scoring engine, as a pure module with a real test fixture set.
- Ranked results with a plain-language reason attached to each plant.
- Filters that match how people actually think: pollinators, low water, deer
  resistant, cut flowers, edible.
- Save a plant list. Share it.

## Phase 3 — Planning and layout

Where this stops being a lookup tool and becomes a product.

- Garden beds: draw them, size them.
- Spacing, mature size, and bloom succession across the season.
- Planting calendar tied to the user's own frost dates.
- Sun modeling, first from solar geometry, later from photos.

## Phase 4 — Nurseries and checkout

- Retailer sign-up and the nursery admin console.
- Inventory in, by CSV upload and manual entry. API integration later, only if
  a partner has one worth connecting to.
- Match a plan against nearby available stock.
- Stripe Connect checkout, or a handoff to the nursery if the marketplace
  model does not pencil out.

## Deliberately later

- Native mobile apps. The web app is enough for a long time.
- Photo analysis of yards. Expensive, and the value only shows up after
  planning exists.
- Anywhere outside the US. Soil and plant data get much harder immediately.
- AI chat. Tempting and easy to add badly. The structured recommendation has to
  be trustworthy first.

## Open questions for you

1. **Which metro first?** Everything downstream depends on this.
2. **Marketplace or referral?** Taking payment is a much better product and a
   much bigger build, including sales tax and perishable inventory.
3. **Ornamental or edible first?** They share plumbing but very little
   horticultural content. Doing both at once doubles the curation work.
4. **Who is the horticultural reviewer?** The curated plant data needs a real
   expert's name on it. Worth lining up before the data work starts.
5. **Is the domain a partnership pitch?** A licensing conversation with the
   Wildflower Center or a regional native plant society may be faster and
   cheaper than building the plant database ourselves.
