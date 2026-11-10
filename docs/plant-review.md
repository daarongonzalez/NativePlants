# Plant review

Status: built 9 November 2026. Waiting on the setup steps below.

A private page where the horticultural reviewer goes through the catalogue one
plant at a time: reads the facts in plain words, picks the photos, checks the
garden game's drawing, writes notes, and approves or fails. Each decision is
saved to the database as it is made.

**Address:** `/admin/review` on the web app, behind Cloudflare Access.

## What the reviewer sees

- **The facts**, in four groups: what it is, size and bloom, ground and
  climate, wildlife and safety. Anything suspicious is shown in clay: a
  missing life cycle or form, a toxicity warning, or a "stays under 24 in"
  claim on a plant that grows taller.
- **Photo candidates** (up to four per plant), each with its licence, the
  photographer's credit and a link to its source page. The reviewer marks one
  as the main photo (the whole plant), one as the close-up, and rejects any
  that are wrong.
- **The garden game's drawing.** For the ten plants in Nativo Garden, the
  game's own words are compared with the sheet (water use and bloom months),
  and the reviewer confirms the drawing looks right.
- **Notes**, then **Approve** or **Fail**. Failing needs a note.

Approve with the button, the A key, or a swipe right on a phone. Fail with the
button, the F key, or a swipe left. S skips. The next plant comes up straight
away. A progress bar and the To review / Failed / Passed / All views show
where things stand.

## What a decision does

| Decision | The plant | Recorded |
|---|---|---|
| Approve | Published: gardeners see it, and the planner stops calling it a draft | `plant_reviews` row with the reviewer's email, notes, the drawing check and the version of the facts approved |
| Fail | Stays a draft | The same, with the notes saying what to change |

Photo choices are saved on `plant_media`: approved as main or close-up,
rejected, or left as a candidate.

## Who owns what

- **The plant sheet owns the facts.** Edit `data/plants/wasatch-plants.csv` as
  before, then run the `plants` load.
- **The review page owns the review status.** A load no longer overwrites it.
  The sheet's `review_status` only sets the status of a plant loaded for the
  first time.
- **A change of facts sends a plant back.** Each load fingerprints every
  plant's facts. If an approved plant's facts change, it goes back to draft
  and shows as "Changed since review", with the earlier decision visible.

## Photos

`scripts/find-plant-images.mjs` searches iNaturalist for research-grade
observations (the species confirmed by the community) and keeps only photos
licensed **CC0** or **CC BY**. That rules out CC BY-NC (a paid product is
commercial use) and CC BY-SA (cropping to our fixed shapes could count as an
adaptation). Utah photos come first.

The results are in `data/plants/image-candidates.json` (128 candidates for
32 of the 33 plants, found 9 November 2026). The `plants` load adds them to
`plant_media` as candidates. Running the search again refreshes links and
credits but keeps every decision.

```bash
NODE_USE_ENV_PROXY=1 node scripts/find-plant-images.mjs
```

Gaps:

- **Mountain snowberry (*Symphoricarpos oreophilus*)** has no openly licensed,
  research-grade photo on iNaturalist. It needs a manual search or our own
  photo.
- **Wild bergamot (*Monarda fistulosa*)** has photos, but none from Utah.
- Four plants are listed on iNaturalist under another accepted name: Colorado
  columbine, tufted evening primrose, creeping Oregon grape and Indian
  ricegrass. The file notes the name used for each.

Candidates link to iNaturalist's own copies. Before launch, approved photos
should be copied into our R2 bucket (`plant_media.r2_key`), so the site does
not depend on another site's links. That copy step is not built yet.

## The garden game

The game's ten plants are listed in `apps/web/app/content/garden-sprites.ts`
with the words the game shows, copied from the game file. Update that list
when the game changes.

**To decide:** the game draws **Desert globemallow (*Sphaeralcea ambigua*)**;
the sheet has **Scarlet globemallow (*Sphaeralcea coccinea*)**. The review
page flags this on the globemallow card. Either the game's plant or the
sheet's should change.

The game's words for Yarrow and Prairie coneflower could not be read from the
game file, so those two cards show no description to check.

The page cannot show the drawing itself yet; it links to the game. A small
artboard in the Rive file showing one plant by name would let the page show
each drawing beside its facts.

## Setup, in order

1. **Apply migration `0003_plant_review`** to the Neon `dev` and `production`
   branches. It only adds columns and one table; nothing existing changes.
2. **Deploy** the API, then the web app.
3. **Run Actions → Run ingestion → `plants`.** This stamps each plant's facts
   fingerprint and loads the photo candidates.
4. **Create the Cloudflare Access application** (Zero Trust → Access →
   Applications → Add → Self-hosted):
   - Domain: the web app's domain, path `admin`
   - Policy: Allow, include the reviewer's email (and yours)
   - Login method: One-time PIN is enough: Access emails a code, no password
5. **Copy two values into `apps/api/wrangler.toml`:**
   - `ACCESS_TEAM_DOMAIN`: your team domain, such as `nativo.cloudflareaccess.com`
   - `ACCESS_AUD`: the application's Audience (AUD) tag, from its overview page
6. **Set `REVIEWER_EMAILS`** in the same file: the same emails as the policy,
   separated by commas. Deploy the API again.

Until steps 4 to 6 are done, the review routes answer "not set up yet" and
show no plant data. They stay closed by default.

## How it is protected

- Cloudflare Access stops anyone who is not on its policy before the request
  reaches our site.
- The API checks Access's signed token again: signed by our team's keys, for
  this application, not expired. A forged or borrowed token is refused.
- The email must also be on `REVIEWER_EMAILS`, so a mistake in one list does
  not open the door.
- The page is marked `noindex`, never cached, and kept out of `robots.txt`.

Tests: `apps/api/src/access.test.ts` (tokens, signatures, the reviewer list),
`packages/db/src/review-repo.test.ts` (decisions, reloads, photos, scoping),
`apps/web/app/lib/review.test.ts` (the queue, facts, game checks, photos).
