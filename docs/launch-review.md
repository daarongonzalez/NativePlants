# Launch review: pages and polish

Status: drafted 8 November 2026, waiting for review.

This lists everything added for launch that needs a person to read it,
confirm a fact or make a call. Work down the list, then flip the draft flags.

## What was added

| Page | Address | Draft? | Where the words live |
|---|---|---|---|
| About | `/about` | Yes | `apps/web/app/routes/about.tsx` |
| FAQ | `/faq` | No | `apps/web/app/content/faq.ts` |
| Lawn rebates overview | `/rebates` | No | `apps/web/app/routes/rebates.tsx` |
| Utah program page | `/rebates/utah` | No | `apps/web/app/routes/rebates.$slug.tsx` |
| Guides list | `/blog` | No | `apps/web/app/routes/blog.tsx` |
| Guide: How lawn rebates work | `/blog/how-lawn-rebates-work` | Yes | `apps/web/app/content/posts/how-lawn-rebates-work.tsx` |
| Guide: What counts as plant cover | `/blog/plant-cover-rule` | Yes | `apps/web/app/content/posts/plant-cover-rule.tsx` |
| Privacy policy | `/privacy` | Yes | `apps/web/app/content/privacy.tsx` |
| Terms of use | `/terms` | Yes | `apps/web/app/content/terms.tsx` |
| My plant list | `/list` | n/a | `apps/web/app/routes/list.tsx` |

Draft pages show a dashed "Draft · awaiting review" badge, carry `noindex`,
and are left out of `/sitemap.xml`. To publish one, set `draft: false` (or
`DRAFT = false` on About).

The Utah program page and the rebate answers in the FAQ read the same rules
file the database loads (`data/rebates/ut-landscape-incentive.json`), so they
cannot drift from the plan check.

## Facts to fill in

All in `apps/web/app/content/site.ts`. Until each is set, the pages show it
as a highlighted gap.

- [ ] `CONTACT_EMAIL`: the inbox for privacy requests and questions
- [ ] `LEGAL_NAME`: the business that runs Nativo
- [ ] `GOVERNING_STATE`: for the terms (Utah is the likely answer)
- [ ] `PLANT_REVIEWER`: name and credentials, once they agree to be named

Also highlighted in place:

- [ ] About: a two- or three-sentence founder story
- [ ] Privacy: how long plan checks are kept
- [ ] Privacy: how long Cloudflare keeps request logs
- [ ] Terms: the liability wording, with a lawyer

## Calls to make

- [ ] **Privacy and terms need a lawyer's read.** They are written to match
  what the code does today, in plain language. They are not legal advice.
- [ ] **The address travels in the page address** (`/report?address=…`). The
  privacy policy says so honestly. If that is not acceptable, the flow needs a
  change before launch, for example keeping the place in a short-lived cookie.
- [ ] **The email section of the privacy policy is a placeholder.** It must be
  rewritten in the same change that adds plan-by-email.
- [ ] **The nav's "Sign in" button is now "My plant list".** Sign-in screens
  were proposed to wait (see `scope.md`). The list lives in the browser, so it
  does not follow people between devices. The FAQ says so.
- [ ] **The landing page's HOA note** now reads as Utah's example: "Some states
  limit what an HOA can require. In Utah, since 2023, …". The wording of the
  Utah law still needs confirming, as before.
- [ ] **Guides 3 to 6** from `plan-2026-11.md` are not written yet: the 8 ft
  lawn rule, drip that qualifies, low park strip plants, and when to start.

## Landing page wording

Headings and the main pitch now speak to any yard. Utah stays as the worked
example, and the Wasatch Front stays as where we serve today.

| Where | Before | After |
|---|---|---|
| Badge | Now open on the Wasatch Front | Now serving the Wasatch Front |
| Heading | Utah would like a word. | Your town would like a word. |
| Lead | what the state will pay you | what your water provider will pay you |
| Water section heading | Utah's water is stretched thin | Water is stretched thin |
| Water section intro | Most of a Utah home's water… | In dry places… Take Utah, where we're starting: |
| Native yard intro | They grew up here. Alkaline soil… | They grew up where you live. Your soil… |
| HOA note heading | Your HOA can't say no | Your HOA may not get a say |
| Psst note | Utah pays $2 a sq ft | In Utah, that's $2 a sq ft |
| Sage, in the sample plot | $400 from Utah | $400 at Utah's rate |
| Page title | Native plants for the Wasatch Front | Native plants and lawn rebates for your yard |

The three water facts keep their Utah figures and source, because they are
measured values.

## Launch polish that was done

- **Saved plant list** at `/list`: save one plant from the planner, or save a
  checked plan's plants with their counts. Change counts, remove, clear (with
  a confirm), print. Stored in the browser only.
- **Printing**: the list, the report and the plan print cleanly, without the
  nav, buttons, shadows or coloured grounds. Collapsed rule text and answers
  open for printing.
- **Error states**: a designed error page for 404s and server errors, a "Try
  again" on the planner when data cannot load, and plain messages when the
  browser will not save the list.
- **Loading**: a small "Loading…" pill on slow page changes, and the address
  button reads "Looking it up…" while it works.
- **Phone checks**: every page checked at 390 px, 820 px and 1440 px wide. No
  sideways scrolling, and nothing tappable under 44 px.
- **Search and answer engines**: FAQ and article markup, a `sitemap.xml` that
  lists only reviewed pages, and a `robots.txt` that keeps the per-address
  pages out.

## Not checked

- The pages were checked against a stand-in API, not the real one, because
  this session has no database access. The flow pages need one real run after
  deploy.
- No real phone was used: the checks ran in a desktop browser at phone width.
