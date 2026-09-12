# Rebate Program Discovery

Status: **parked** — researched and shelved deliberately, September 2026.

> **On the shelf until V1 ships.** This is a real asset and a strong acquisition
> channel, and it is exactly the kind of work that quietly becomes a second
> product and delays the first. Nothing here gets built until V1 is live in one
> market. The Utah slice (one statewide program, ~60 communities) is the only
> part that comes forward early, and only as a display field.
>
> Revisit trigger: V1 shipped and converting in the Wasatch Front.

## The short answer

**No authoritative registry exists.** That is the opportunity, not the obstacle.

Energy incentives have DSIRE — a comprehensive, maintained, canonical database
run out of NC State. Water has no equivalent. What exists instead:

- **EPA WaterSense Rebate Finder** covers WaterSense-*labeled products* —
  toilets, showerheads, faucets. It is partner-submitted and largely silent on
  landscape and turf rebates, which are the ones that matter to us.
- **Small aggregator sites** (thepollinatorpatchgarden.com, lawnbyseason.com,
  monarchmld.com) are the best public coverage. They are SEO content
  businesses. Useful as a lead list, unusable as a source of truth — staleness
  is invisible, coverage is uneven, and nothing is structured.
- **State and utility pages** are authoritative but scattered across hundreds of
  separate websites with no common format.

So the honest state of the world: a homeowner who wants to know what they
qualify for has to already know which utility serves them, then find that
utility's page, then read a PDF. That is a bad experience, and it sits directly
upstream of our product.

## The structural fact that makes this tractable

**Rebates are administered by water utilities, not by cities or states.**

Utah is the exception that misleads — it runs a statewide program, so a
state-level answer happens to be right there. Almost everywhere else, two
neighbors on the same street can qualify for different amounts because they are
served by different water districts. Any ZIP-based or city-based answer will be
wrong often enough to destroy trust.

The correct join is geographic: **address → point → water system service area
polygon → the program that serves it.**

Which is the same PostGIS query shape we already built for soil. The
architecture we chose for the site profile handles this with no new machinery.

## Method

### Layer 1 — Frame the universe

Start from the set of every entity that *could* run a program:

- **EPA Community Water System Service Area Boundaries** — a national dataset
  combining state-published boundaries with modeled boundaries where states
  publish nothing.
- **SimpleLab / EPIC open-source dataset** — the first open national map of
  drinking water service areas, released with the Internet of Water Coalition.
- **USGS public-supply service area boundaries** — 22,849 community water
  systems, excluding most systems serving under 1,000 people.

Use these as the denominator and as the geometry. Cross-check the three where
they disagree; boundary quality varies a lot by state.

### Layer 2 — Narrow to plausible candidates

Twenty-two thousand systems is not a research project anyone finishes. Filter:

- Arid and semi-arid climate zones (aridity index or Köppen classification)
- Population served above a threshold — 25,000 is a reasonable starting cut
- States with known water stress or existing statewide programs

That should yield a few hundred candidates, not tens of thousands.

### Layer 3 — Verify by hand, once

For each candidate, record a structured row:

```
program_name, administering_utility, service_area_geom,
rebate_per_sqft, max_award, annual_budget,
requires_pre_approval, requires_submitted_plan,
plant_list_url, min_plant_coverage_pct,
application_window_open, application_window_close,
program_status, source_url, verified_at, verified_by
```

Seed the list from the aggregator sites — they are a useful lead list — then
**confirm every row against the utility's own page.** Never cite an aggregator
as the source.

This is perhaps 150–300 programs. It is roughly a week of unglamorous work, and
when it is done nobody else has it clean and structured.

### Layer 4 — Keep it current, or it is worthless

This is where every aggregator fails and why the gap persists. Programs change
annually, budgets exhaust mid-season, and application windows close without
notice. Utah's own program has documented spring closures when demand outruns
processing.

- A scheduled fetch per program page that diffs content and flags changes for
  review
- A hard `verified_at` on every row, surfaced in the interface — never show a
  rebate amount without saying when we last checked
- A quarterly manual re-verification pass
- Never display a program whose `verified_at` is older than a set threshold;
  show "verify with your utility" instead

Cloudflare Cron Triggers and Queues handle the fetch-and-diff. Same ingestion
pattern as the soil and climate jobs.

## Using the registry to rank markets

Once it exists, market selection stops being a judgment call and becomes
arithmetic. Rank candidate metros on:

- **Rebate dollars available per household** in the service area
- **Whether a plan is required** — this is the wedge, and it is binary
- **Program budget and historical conversion volume** — how much is actually
  being paid out
- **Evidence of an approval bottleneck** — a pain signal, and a reason for the
  utility to want us
- Then the earlier factors: soil difficulty, nursery density, proximity

## Why this is three assets, not one

### 1. Market selection (internal)

The thing you asked for. It tells us where to go next after Utah, with numbers
rather than intuition.

### 2. An acquisition channel (external) — SEO and answer-engine surface

"Turf rebate [city]" is a high-intent query, and the pages currently winning it
are thin affiliate content. A page per program carrying accurate, current,
structured data — amount, requirements, deadlines, and what plants qualify —
should outrank them, and it compounds.

It is also an **answer-engine surface**, which may matter more than search
ranking within a couple of years. When someone asks an assistant "what turf
rebate can I get in Sandy, Utah," the answer gets assembled from whatever
structured, current, citable source exists. Today that is thin affiliate content
with no verification dates. A registry with per-program `verified_at` stamps,
explicit sourcing back to the utility, and clean schema markup is precisely what
an answer engine prefers to cite — and being the cited source is a better
position than being the top blue link.

Two things this implies for how the pages get built, whenever they get built:
structured data markup on every program page, and the verification date visible
in the page content rather than buried in a footer.

This is the cheapest acquisition channel available and it happens to sit in your
professional wheelhouse. It is also durable in a way paid traffic is not.

### 3. A product feature

"Your address qualifies for $2.00 per square foot, up to $X. Here is a plan
that meets the 50% coverage requirement, using plants that will survive your
soil." That is a complete, specific, transactional answer that nobody else in
the market can give.

## Go to market

### The funnel this creates

```
rebate search  →  our program page  →  "what does your yard qualify for?"
               →  address  →  site profile  →  compliant plant plan
               →  local nursery
```

Compare that to "garden planning app," where we would have to manufacture
intent. Here the intent already exists and is already transactional — someone
searching for a turf rebate has money on the table and a deadline.

### On paid ads — a caution

You raised targeted ads, and they will work, but watch the economics. You would
be bidding against landscape contractors whose customer is worth $10,000–15,000
on a single install. Ours is worth $25 a month. We lose that auction on any
keyword they also want.

Paid has a place — narrow, defensive, on branded and long-tail terms — but it
should not be the primary channel. SEO and partnerships have far better
economics for this specific product.

### The channel most people would miss

**The water districts themselves are distribution partners, not just data
sources.**

They have conservation targets to hit, budget allocated to pay out, and a
documented bottleneck in plan review — which is *their* operational problem,
not ours. A tool that produces compliant plans and reduces their review burden
is something they have a real incentive to promote.

Getting listed on a state or district site as a recommended planning resource is
worth more than any realistic ad budget, and it carries institutional
credibility that advertising cannot buy. In Utah specifically, the program
already offers free planning resources and plan reviews — which means the need
is acknowledged and the current answer is thin.

Worth a conversation before it is worth an ad spend.

### Nursery alignment

Nurseries in rebate markets already know about the programs and already field
the questions. A homeowner arriving with an approved, compliant plant list is a
better customer than one wandering the aisles. That is the pitch for Phase 4,
and the rebate framing makes it concrete in a way "we'll send you customers"
never is.

## Sequencing — the part to get right

**Do not build the national registry before V1 ships.**

It is a genuinely valuable asset and it would make a fine second product, which
is exactly the risk. Order of work:

1. **Utah only.** One statewide program plus roughly 60 participating
   communities. A day or two of verification, not a week.
2. **Ship V1 with rebate awareness in it.** Prove the funnel converts in one
   market where you can watch it closely.
3. **Then expand the registry**, ranked by the scoring above, one market at a
   time — and only as fast as plant curation for that market can follow. A
   rebate page for a metro whose plants we have not curated sends people to a
   dead end.

The registry scales faster than curation does. Let curation set the pace.

## Data model addition

```
rebate_programs      id, name, utility_name, geom(MultiPolygon),
                     per_sqft_amount, max_award, requires_pre_approval,
                     requires_plan, min_plant_coverage_pct, plant_list_url,
                     window_open, window_close, status,
                     source_url, verified_at, verified_by

water_systems        pwsid, name, geom(MultiPolygon), population_served, source
```

Joined to a site by `ST_Contains(rebate_programs.geom, sites.geom)` — the same
spatial containment query already used for soil map units.

## Open questions

1. Does Utah publish its waterwise plant list in a form we can align to? If so
   that is both curation we skip and a credibility marker.
2. Would a district or the state consider listing us as a planning resource?
   Worth asking early — the answer shapes the whole acquisition plan.
3. How much does plan review actually cost them per application? That number is
   the partnership pitch.

## Sources

- [EPA Community Water System Service Area Boundaries](https://www.epa.gov/ground-water-and-drinking-water/community-water-system-service-area-boundaries)
- [EPA service area boundaries data standard (PDF)](https://www.epa.gov/system/files/documents/2024-04/cws-service-area-boundaries-data-standard.pdf)
- [EPIC, water utility service area boundaries](https://www.policyinnovation.org/technology/water-utility-service-area-boundaries)
- [SimpleLab, building the open-source dataset of US water system service areas](https://mytapscore.com/blogs/tips-for-taps/how-simplelab-built-the-open-source-dataset-of-us-water-system-service-areas)
- [USGS, public-supply community water service area boundaries](https://www.usgs.gov/publications/development-and-evaluation-public-supply-community-water-service-area-boundaries)
- [EPA WaterSense Rebate Finder](https://lookforwatersense.epa.gov/rebates)
- [The Pollinator Patch Garden rebate directory](https://www.thepollinatorpatchgarden.com/rebates)
- [Lawn by Season, turf removal rebates by city](https://lawnbyseason.com/turf-removal-rebate)
- [Utah Water Savers, Landscape Incentive Program](https://www.utahwatersavers.com/landscapeincentiveprogram)
- [SoCal Water$mart turf replacement program](https://socalwatersmart.com/en/residential/rebates/available-rebates/turf-replacement-program/)
- [Colorado Turf Replacement Grant Program](https://engagecwcb.org/turf-replacement-grant-program)
