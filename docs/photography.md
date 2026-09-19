# Photography

Status: draft, September 2026. Catalogue work is in V1; user uploads are parked.

## These are two different problems

They get discussed as one thing and they share almost nothing.

| | Catalog photography | User-uploaded yard photos |
|---|---|---|
| Volume | Fixed. ~300 plants | Unbounded. N per user, forever |
| Control | Ours | Not ours |
| Contains PII | No | Yes, unavoidably |
| Main cost | Human labour and licensing | Inference, and legal exposure |
| Main risk | Looking amateur | Storing something we shouldn't |
| V1? | Yes | No |

Deciding them together is how projects end up with a photo feature that is
both legally exposed and visually inconsistent.

---

## Part 1 — Catalog photography

### The licensing trap

iNaturalist and Wikimedia are the obvious free sources. Images there are
licensed **individually**, not in bulk, and a large share are **CC-BY-NC**.

**NC means non-commercial, and a paid subscription product is commercial.**
That eliminates those images entirely, regardless of how good they are.

Usable: CC0, CC-BY, CC-BY-SA. With caveats —

- **CC-BY** requires attribution stored per image and displayed where the image
  appears. Not a footer link. This is why `plant_media` carries `credit`,
  `license` and `source_url` as non-null columns.
- **CC-BY-SA** carries share-alike obligations, and a crop is arguably a
  derivative. Avoid it rather than reason about it.

Filtering has to happen at ingest. An NC image that slips into the catalogue is
a licence violation that ships to every user.

### Identification risk

Community photos are identified by community consensus. Usually right. Not
always.

A misidentified photo on a plant page is a credibility problem on an ordinary
plant and a **safety problem** on an edible or toxic one. Every catalogue image
needs a verification step by the same reviewer who signs off the plant data.
That is labour, and it belongs in the curation budget.

### The multiplier nobody plans for

You do not need one photo per plant. You need roughly four:

1. **In flower** — what sells it
2. **Out of flower** — what it looks like for the other ten months
3. **Foliage detail** — for identification
4. **Mature habit** — the whole plant at size, for spacing decisions

The second one matters more than it sounds. A plant that looks spectacular in
June and looks like brown sticks in March is a fine choice, but the gardener
has to know that **before** planting, not after. Showing only the bloom shot is
the thing every nursery catalogue does and every gardener resents.

So 300 plants is roughly **1,200 images** to source, licence-check, verify and
crop.

### The constraint that actually sets the schedule

**Photography is seasonally gated.** You cannot photograph a spring ephemeral
in October. If commissioned shooting is part of the plan, a complete library
needs visits across a full growing season — which means the library is 12
months behind whenever you start.

Practical consequence: **year one runs on licensed images**, and commissioned
photography starts in parallel for year two. Treating it the other way round
delays launch by a season for no product gain.

### Consistency is the real design problem

Mixed sources mean mixed backgrounds, light, seasons, and crops. Placed next to
a competitor's uniformly photographed library, that reads as unfinished.

Two honest options:

1. **Design around it.** A consistent frame, a fixed aspect ratio, a subtle
   background treatment, and consistent crop rules normalise a lot. Cheap, and
   it never looks as good as option two.
2. **Commission it.** A local photographer at a nursery or botanical garden.
   Realistically several hundred dollars per session and several sessions
   across a season for bloom coverage — call it a few thousand dollars for a
   proper regional library, spread over a year by necessity.

Start with option one. Budget for option two once the product has revenue.

### Decide the aspect ratio before sourcing image one

This is the cheapest decision now and one of the most expensive later.
Re-cropping 1,200 images because the card layout changed is a week nobody
planned for.

Proposed: **4:3 landscape** for habit and in-situ shots, **1:1** for foliage
and flower detail. Two ratios, no more. Written into the design system before
sourcing starts.

### Storage cost: negligible

300 plants × 4 images × ~400 KB ≈ **480 MB**. R2's free tier is 10 GB.

Storage is not a consideration here and should not be allowed to influence any
decision about the catalogue.

---

## Part 2 — User-uploaded yard photos

> **PARKED.** Not in V1, and not a near-term build. The concerns below are the
> reason, recorded so the decision does not have to be re-derived. See
> [scope.md](scope.md) for the authoritative boundary.
>
> **Revisit trigger:** V1 shipped and converting, retention and privacy policy
> drafted and reviewed. Build the canvas before the analysis.

Here is what will matter when it is.

### What a yard photo actually contains

The yard, and also: the house number, license plates, the neighbours' windows,
children, interiors visible through glass, and sometimes a security system
keypad.

The moment we accept the first upload we own a moderation and liability
surface. Minimum bar before that happens:

- **No public URLs, ever.** Short-lived signed URLs only.
- A written retention policy, decided **before** the first upload. Deleting
  later is far harder than never storing.
- Account deletion actually deletes the images.
- If photos are ever used to improve the product, that is separate explicit
  consent, not a line in the terms.

### Strip EXIF server-side, at ingest

Phone photos carry precise GPS coordinates, device identifiers and timestamps.

Strip all of it, on the server, before the bytes reach storage. Two reasons:

1. **Privacy.** Nobody uploading a photo of their flower bed expects it to
   carry their home's coordinates.
2. **Temptation.** We could use that GPS to locate the site automatically. We
   should not, because they gave us a photo, not a location. The site's
   coordinates come from the address they typed.

Client-side stripping is not sufficient — it is trivially bypassed and it fails
silently.

### What vision can actually do — the honest version

This is where expectations usually outrun reality.

| Task | Realistic quality |
|---|---|
| Identify existing plants in the frame | **Good**, especially with a regional prior narrowing candidates |
| Detect hardscape, fence, structures | **Good** |
| Estimate mature size / spacing context | **Fair** |
| Estimate sun and shade hours | **Poor.** Shadows in one frame give the sun angle at one moment, not hours of exposure across a season |
| Measure area in square feet | **Poor** without a reference object — and this one is dangerous, because a rebate application depends on the number and the gardener will trust it |
| Assess soil condition | **Essentially nothing.** Surface colour says very little and pH is not visible |

Two conclusions follow.

**First, never let a vision estimate silently replace a measured value.** A
modelled sun figure and a surveyed soil pH cannot look the same in the
interface. The design system already has the confidence language for this; a
photo-derived value is `low` confidence and says so.

**Second, and more important: the photo's best job is probably not analysis.**

Its best job is being a **canvas** — something to place plants on, to show a
before and after, to make the plan feel like *their* yard rather than a generic
list. That is what makes a competitor's render compelling, and it needs almost
no inference. The analysis is a bonus on top.

That reframing changes the build: a canvas feature is mostly front-end work on
an uploaded image. An analysis feature is a model pipeline with per-request
cost and accuracy caveats. The first is cheaper, more useful, and lower risk.

### The derivative pipeline

Never send an original to a browser or a model. Four artifacts per upload:

1. **Stripped original** — archived, never served directly
2. **Display derivative** — ~1600 px longest edge
3. **Thumbnail** — ~400 px
4. **Model-sized** — matched to the vision tier being used

**Architecture note that saves real money:** keep originals in **R2** and use
Cloudflare Image Transformations on top of them. Then you pay only for
transformations — $0.50 per 1,000, with 5,000 free per month — and nothing for
storage or delivery. Putting the originals into **Cloudflare Images storage**
instead adds $5 per 100,000 stored and $1 per 100,000 delivered on top of the
same transformation fee. Same feature, two prices, easy to get wrong.

### Cost math

Claude's vision cost is `ceil(width/28) × ceil(height/28)` visual tokens,
capped at 1,568 tokens per image on the standard tier. So a downscaled yard
photo costs at most ~1,568 input tokens.

One analysis — one photo, a ~500 token prompt, ~800 tokens out:

| Model | Approx. cost per analysis |
|---|---|
| Claude Opus 5 ($5 / $25 per MTok) | **~$0.03** |
| Claude Sonnet 5 ($2 / $10 per MTok) | **~$0.01** |

A four-photo yard walkaround on Opus 5 lands around **$0.05–0.06**.

At 1,000 analyses a month that is $30–60. Real but unalarming. The thing to
notice is that **this is the one cost that scales with usage rather than with
users** — and the free tier is where it gets abused.

### Storage cost at scale: still not the problem

R2 standard storage is $0.015/GB-month with **zero egress**.

| Users | Photos each | Stored | Monthly |
|---|---|---|---|
| 1,000 | 4 | ~12 GB | ~$0.18 |
| 10,000 | 4 | ~120 GB | ~$1.80 |
| 100,000 | 4 | ~1.2 TB | ~$18 |

(Assuming ~2 MB originals plus derivatives.)

**Storage is not the cost. Inference and liability are.** Any conversation that
frames photo upload as a storage question is looking at the wrong number.

### Abuse controls, before launch not after

Free tier plus paid inference is an obvious hole. Needed on day one of the
feature:

- Per-account upload rate limit and a monthly analysis cap
- Hard file size and dimension limits, enforced server-side
- Reject non-image content types by sniffing bytes, not by trusting the
  extension or MIME header
- Analysis behind authentication, never anonymous

---

## Recommendations

1. **V1 ships with no user photo upload.** This analysis supports the existing
   roadmap position rather than changing it.
2. **V1 catalogue: licensed images only.** CC0 and CC-BY, filtered at ingest,
   ~300 plants × 2 images to start (habit and detail), each verified by the
   horticultural reviewer. Grow to four images per plant over year one.
3. **Start sourcing now.** Licensing and verification are slow and photography
   is seasonally gated. This is the asset most likely to be the thing holding
   up a spring launch.
4. **Settle aspect ratios and the frame treatment before sourcing image one.**
5. **When upload arrives, build the canvas first and the analysis second.**
6. **Write the retention and privacy policy before accepting a single upload.**

## Sources

- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing)
- [Claude vision documentation](https://platform.claude.com/docs/en/build-with-claude/vision)
- [Creative Commons licence list](https://creativecommons.org/share-your-work/cclicenses/)
