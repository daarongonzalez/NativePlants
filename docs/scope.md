# V1 Scope Boundary

Status: authoritative. September 2026.

This is the single list. When something is proposed and someone asks "is that in
V1?", the answer is here and nowhere else. Anything not listed as in-scope is
out of scope, including good ideas.

## In scope

| Capability | Notes |
|---|---|
| Gardener sign-in | Firebase, email + Google |
| Address entry and geocoding | Census geocoder, with a draggable pin |
| Hardiness zone | From our own ingested table |
| Frost probability bands | NOAA 1991–2020, 10/50/90 percent |
| Soil pH, texture, drainage | SSURGO, Wasatch Front counties only |
| Sun hours | Solar geometry from latitude, marked as modelled |
| Site constraints | Deer, pets, children, irrigation, HOA |
| Site profile report screen | The hero artifact; gets real design time |
| Plant recommendations | 60–100 curated species, one market |
| Reasons on every recommendation | Plain language, from the scoring engine |
| Goal filters | Pollinators, low water, deer resistant, cut flowers, edible |
| Saved plant list | Printable — this is what goes to a nursery in V1 |
| Profile error reporting | A gardener telling us we got it wrong |

**Market:** Wasatch Front only — Salt Lake, Utah, Davis and Weber counties.

## Out of scope, with the reason

Each of these has been considered and deliberately deferred. The reason matters
as much as the decision, because it is what tells us when to revisit.

### Photo upload and storage — **parked**

The largest deferral, and the one most likely to be re-litigated. See
[photography.md](photography.md) for the full analysis. Summary of concerns:

- **Privacy surface we would own from the first upload.** A yard photo carries
  EXIF GPS, and in frame it carries house numbers, license plates, neighbours'
  windows, children, and interiors visible through glass.
- **Retention policy must exist before the first byte is stored.** Deleting
  later is far harder than never storing. Account deletion has to actually
  delete. Any use for product improvement is separate explicit consent.
- **Vision cannot do the things people assume.** Sun-hour estimation from a
  single frame is poor. Area measurement is poor without a reference object —
  and area feeds rebate applications, where a wrong number a gardener trusts
  has a financial consequence.
- **The cost that scales is inference, not storage.** Storage is roughly $18 a
  month at 100,000 users. Analysis is ~$0.03 per photo on Opus 5, ~$0.01 on
  Sonnet 5, and a free tier with no per-account cap is an open invoice.
- **Abuse controls would be needed on day one**, not after: per-account upload
  and analysis caps, server-enforced size and dimension limits, content-type
  sniffing by bytes, and no anonymous analysis.
- **The valuable version is a canvas, not an analyser.** Placing plants on a
  photo of your own yard is what makes a plan feel real, and it needs almost no
  inference. That reframing changes the build enough that starting with
  analysis would be building the wrong thing first.

**Revisit trigger:** V1 shipped and converting, and the retention and privacy
policy drafted and reviewed. Build the canvas before the analysis.

**What V1 does instead:** nothing. No upload control, no R2 bucket for user
media, no vision calls. The `plant_media` table serves catalogue images only.

### Everything else out of scope

| Deferred | Reason |
|---|---|
| Garden layout and bed drawing | Phase 3. Depends on the profile being trusted first |
| Nursery accounts and inventory | Phase 4. Needs signed partners, not code |
| Payments and subscriptions | Phase 4. Marketplace vs referral is undecided |
| Rebate registry | Parked — see [rebate-programs.md](research/rebate-programs.md). Utah appears as a display field only |
| Native mobile apps | The web app is enough for a long time |
| Any market outside the Wasatch Front | Curation sets the pace, not code |
| AI chat | The structured recommendation must be trustworthy before anything speaks for it |
| Commissioned photography | Seasonally gated; year one runs on licensed images |
| Retailer and admin roles | Schema and middleware shape exist; no UI, no routes |

## Catalogue photography — in scope, with constraints

Distinct from user uploads and **not** parked. V1 needs plant images.

- **Licensed only.** CC0 and CC-BY. **CC-BY-NC is unusable** — a paid
  subscription is commercial use.
- **Attribution stored per image and displayed** where the image appears. This
  is why `plant_media.credit`, `.license` and `.source_url` are non-null.
- **Every image verified by the horticultural reviewer.** Misidentification is
  a credibility problem on an ordinary plant and a safety problem on an edible
  or toxic one.
- **Two images per plant for V1** — habit and detail — growing to four (in
  flower, out of flower, foliage, mature habit) across year one. The
  out-of-flower shot is not optional; a plant that is brown sticks for ten
  months is a fine choice only if the gardener knows in advance.
- **Aspect ratios fixed before sourcing image one:** 4:3 for habit, 1:1 for
  detail. Re-cropping a thousand images later is an unplanned week.
- **Storage is not a consideration.** ~480 MB against a 10 GB free tier.

## How to change this document

Scope changes are fine. Silent scope changes are not. Anything added here needs
a line saying what moved out to make room, because the constraint is calendar
time and reviewer attention, not ambition.
