# The proposed plan, the PDF, and selling it

Status: steps 1 and 2 built, 15 November 2026 (see [Built](#built)). Step 3,
selling, is next. Decided: the plan generator, Resend for email, the free /
plan pack / reviewed plan tiers to test, and no photo upload while the address
estimate gives the square footage.

## The idea

Someone gives us their address (or a photo of their yard), we estimate the
area, and we hand back a **proposed plan** they could take to the rebate
program and a nursery, as a **PDF**. The free tools stay free; the finished,
rebate-ready plan is what we sell.

## What we already have

Most of the pieces exist. What is missing is the step that turns them into a
plan without the gardener painting every square.

| Piece | Status |
|---|---|
| Address to lot, house and yard sizes, with front, back and side | Built (yard estimate) |
| Soil, zone, frost and sun for the spot | Built (report) |
| Plants ranked for that ground, each with plain reasons | Built (recommendation engine) |
| Every plan-checkable rebate rule, with the program's own words | Built (rebate check) |
| A printable plan and plant list | Built (print styles) |
| **A plan drawn for them** | Not built |
| **A PDF we generate and send** | Not built: today people use their browser's "Save as PDF" |
| **Payment** | Not built, and out of V1 scope today |
| **Photo upload** | Not built, and parked in `scope.md` |

## 1. Getting the area: address first, photo as a helper

**Address stays the main route.** It already gives a measured lot and a yard
split, it costs nothing, and it raises no privacy questions beyond what we
handle now.

**A photo should help people confirm and adjust, not measure.** The reasons
in `scope.md` still hold: one photo cannot give square footage reliably, and a
wrong number feeds a rebate application. Where a photo genuinely helps:

- the gardener marks "this is the lawn I'm replacing" on our aerial view, or
  on their own photo, for the plan drawing;
- in a paid, reviewed plan, our horticultural reviewer looks at it to catch
  what public data cannot: a big tree, a slope, a downspout, shade;
- the program itself asks for photos of the existing lawn, so we can tell
  people exactly which ones to take.

Before any photo is stored, `scope.md` asks for (and we should keep):

- location data (EXIF GPS) stripped on upload;
- private storage, deleted after a fixed time (90 days suggested) or on
  request, and never used to train anything;
- upload limits per person, file type checked by its contents;
- uploads only for paid plans at first, which keeps abuse and cost low.

**Recommendation:** no photo upload for launch. Add it with the reviewed plan
(below), once the retention rules are written into the privacy policy.

## 2. The proposed plan: drawn for them

A plan generator, built the same way as the rest of the engine: rules, not a
black box, so every choice can be explained and Rachel can review it.

1. **Start from the area** the gardener chose (front, back or park strip) and
   its size from the estimate, adjusted to their tape measure.
2. **Pick 4 to 8 plants** from the ranked list for their ground: a mix of
   forms (groundcover, wildflower, grass, shrub), flowers across the season,
   pollinator value, and only low plants in a park strip.
3. **Lay them out** in the planner's 5 ft squares: larger shrubs at the back
   or corners, drifts of perennials, groundcovers to fill. Each plant spaced
   at its grown width.
4. **Aim for 55% plant cover** when grown (the rule is 50%; the margin covers
   plants that grow smaller than the sheet says), with mulch for the rest and
   an optional path.
5. **Run the rebate check.** If any rule fails, adjust and check again. The
   plan we hand over passes every rule we can check, and lists the rest as
   "you confirm" or "the inspector checks".
6. **The gardener can then edit it** in the planner as they do today.

This needs no outside service and can be tested like the rest of the engine.

## 3. The PDF

What goes in it, in the order a gardener needs it:

1. **The drawing**: the area seen from above, to scale, with a plant key. The
   program's application asks for exactly this.
2. **The plant list**: counts, sizes, and the scientific name to ask for at
   the nursery.
3. **The rule checklist**: what passes, what they confirm, what the inspector
   checks, each with the program's words.
4. **The timeline**: apply while the lawn is green, wait for approval, finish
   within 12 months, avoid the October-to-April inspection gap.
5. **Their ground**: soil, zone, frost dates and sun, with sources.
6. **The estimate behind it**, labelled as an estimate.

**How to make it.** We already have print styles. The cleanest route is to
build one "plan document" page, styled for paper, and turn it into a PDF with
**Cloudflare Browser Rendering** (a headless browser that runs on our existing
Cloudflare account). One design serves the screen, the printer and the PDF.
Browser Rendering is billed by browser time; at our volume that should be
small, but check the current price before relying on it. Until then, the same
page works with the browser's own "Save as PDF", for free.

**Delivery.** Download on the spot, and by email (this is the plan-by-email
item from the launch list). Email needs an email service: Resend is still my
recommendation.

## 4. Selling it

A suggested shape, to test rather than fix:

| Tier | What they get | Price |
|---|---|---|
| **Free** | Yard estimate, report, planner, rule check, plant list, print | Free |
| **Plan pack** | The proposed plan, drawn for them, the PDF, emailed, editable for 30 days | Starting idea: $29 to $49 |
| **Reviewed plan** | Plan pack, plus Rachel reviews the plan and their yard photos, with written notes, within 5 working days | Starting idea: $99 to $149 |

Why these prices are plausible: Utah pays $2 a sq ft, so a 600 sq ft front
yard is worth about $1,200 in rebate. A plan pack is a small share of that,
and far less than a landscape designer. **These are starting guesses, not
research.** A small test (two prices, a few weeks) would tell us more.

**Taking payment.** Stripe Checkout: Stripe hosts the payment page, so card
details never touch our site. After payment, we unlock the plan and email a
link to it. No account needed: the email link is the key.

**What else selling changes:**

- `scope.md` lists payments as out of V1. Adding them means recording what
  moves out to make room, as that document asks.
- We would store an email address and a saved plan for each buyer. The
  privacy policy and terms need a section on that, and on refunds.
- Sales tax on digital goods in Utah: ask an accountant.
- The reviewed plan depends on Rachel's time. Decide how many a week she can
  take before offering it.

## Suggested order

1. **The plan generator and the plan document page**, with browser "Save as
   PDF". Free, no outside service. This is the heart of it, and we learn
   whether the generated plans are good before charging for them. Rachel
   reviews a sample.
2. **The generated PDF and email delivery** (Browser Rendering and Resend).
3. **Stripe Checkout** and the plan pack.
4. **Photo upload and the reviewed plan**, once retention rules are written.

## Decisions for D'Aaron

1. **Go ahead with step 1**, the plan generator and plan document page?
2. **Email service:** Resend?
3. **Selling:** do the tiers and starting prices feel right to test?
4. **Photo upload:** wait for the reviewed plan, as recommended, or sooner?
5. **Rachel:** would she take on reviewed plans, and how many a week?

## Built

**Step 1: the plan generator and the plan document.**

- `packages/engine/src/propose.ts`: draws a plan for an area. Keeps plants
  that count towards cover (perennials, not trees; only low plants in a park
  strip), picks 3 to 8 with one of each form and no repeated genus, lays them
  out tall at the back and low at the front in drifts, aims for 60% cover with
  a mulch path and front edge, then runs the rebate check and plants mulch
  squares if cover falls short. Tested on the real plant sheet against the
  real Utah rules.
- `POST /v1/public/rebates/:code/proposals`: ranks plants for the yard's soil,
  zone, frost and sun with the scoring engine, and draws the plan. Without a
  soil reading, it picks by form and size and says so.
- The planner's **Draw a plan for me** button loads the plan into the planner
  to edit, with each plant's count and reason.
- `/plan/document`: the plan for paper and PDF: the drawing to scale with a
  key, the plants to buy, the rule checklist, the steps in order, the ground,
  and the sources. **Save as PDF or print** uses the browser's print dialog.
- The plan travels in the link (`apps/web/app/lib/plan-link.ts`), so nothing
  is stored and the link opens the plan anywhere, including back in the
  planner.
- Plant counts now handle wide shrubs: one 10 ft serviceberry fills four
  squares, so the list says 1, not 4 (this also corrects the planner's list).

**Step 2: plan by email (Resend).**

- **Email me this plan** on the plan document sends one email with the link.
  The API only sends links to plan documents on grownativo.com, so the form
  cannot send anything else. Five a minute per visitor. Nothing is stored.
- The privacy policy now describes it.

**To switch email on:**

1. Create a Resend account, add the domain `grownativo.com`, and add the DNS
   records Resend shows (in Cloudflare DNS). Wait for it to say "Verified".
2. Create an API key in Resend (sending access is enough).
3. Add it as a secret named `RESEND_API_KEY` on the `nativeplants-api` Worker.
4. Optional: change `EMAIL_FROM` in `apps/api/wrangler.toml` (now
   `Nativo <plans@grownativo.com>`).

Until then, the form says email is not switched on yet, and the PDF still
works.

**Not yet:** a PDF made on our side (Cloudflare Browser Rendering) to attach
to the email. The browser's own "Save as PDF" covers it for now.

**Next: step 3, selling.** Stripe Checkout for the plan pack ($29 to $49 to
test) and the reviewed plan ($99 to $149). Needs a Stripe account; test-mode
keys are enough to build and try it.
