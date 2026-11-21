# Where Nativo stands

Status: 15 November 2026. **Start here** in a new session. Update this page
at the end of each piece of work.

## What is live

grownativo.com runs on two Cloudflare Workers, deployed from `main`:

- `nativeplants-web`: the site (`apps/web`, React Router v7).
- `nativeplants-api`: the API (`apps/api`, Hono). No public address
  (`workers_dev = false`); the site reaches it through its `API` service
  binding.

What a visitor can do today:

1. Type an address on `/start`.
2. See the report on `/report`: zone, frost dates, soil, sun, and a yard
   estimate from county lot records and an aerial photo.
3. Plan a bed on `/plan`, by hand or with **"Draw a plan for me"**, and check
   it against the Utah rebate rules.
4. Open the **plan document** (`/plan/document?p=…`): drawing, plants table,
   rules, steps. Print it, or have it emailed (once Resend is set up).
5. Save plants to **My plant list** (`/list`, stored in the browser).
6. Read the content pages: About, FAQ, rebates, two guides, privacy, terms.

The reviewer works on `/admin/review`, behind Cloudflare Access.

## Pull requests in this stretch

| PR | What it added | Doc |
|---|---|---|
| #24 | Content pages, privacy, terms, launch polish, location-neutral landing copy | [launch-review.md](launch-review.md) |
| #25 | The garden game with plant sprites (the user's branch) | — |
| #26 | The plant review page, photo candidates, sprite checks | [plant-review.md](plant-review.md) |
| #28 | The yard estimate from an address | [yard-estimate.md](yard-estimate.md) |
| #29 | Cloudflare Access values for the review page | [plant-review.md](plant-review.md) |
| #30 | Rate limits and error alerts | [launch-review.md](launch-review.md#rate-limits-and-error-alerts-added-15-november-2026) |
| #31 | The plan generator, plan document and plan email | [plan-pack.md](plan-pack.md) |

## Accounts and settings

| What | Value |
|---|---|
| Neon project | `cool-term-95598834` |
| Database the live site reads | Neon branch **`dev`** (`br-winter-flower-ae0lr1gs`), through Hyperdrive `df4a5c68e1464a9db5e7080829fce511` |
| Neon `production` branch | `br-withered-waterfall-aezm0f3t`. Has the schema, but **no plants**. Not used by the site yet |
| Migrations | 0000 to 0003 applied on both branches |
| Cloudflare Access | Team `apostrophe.cloudflareaccess.com`, application covering `/admin/*`. The AUD is in `apps/api/wrangler.toml` |
| Planner plants | `PLANNER_PLANTS = "drafts"` in `apps/api/wrangler.toml` |
| Email sender | `EMAIL_FROM = "Nativo <plans@grownativo.com>"` in `apps/api/wrangler.toml` |

**Secrets** (set in the Cloudflare dashboard, never in the repo):

| Secret | Worker | State |
|---|---|---|
| `REVIEWER_EMAILS` | `nativeplants-api` | Set |
| `RESEND_API_KEY` | `nativeplants-api` | **Not set.** Until it is, the email form shows an error and sends nothing |
| `ALERT_WEBHOOK_URL` | both | Not set (optional). Errors still go to Workers Logs |

**Database contents** (dev branch, last checked 15 November 2026): 33 plants,
all drafts; 128 photo candidates; 0 review decisions; 0 published.

## What is left for launch

**For the owner (not code):**

- Rachel's review of the 33 plants (0 done). Then set
  `PLANNER_PLANTS = "published"`.
- Resend: verify `grownativo.com` in Resend, then add `RESEND_API_KEY` on
  `nativeplants-api`. Steps in [plan-pack.md](plan-pack.md).
- Optional: `ALERT_WEBHOOK_URL` on both Workers.
- Site facts in `apps/web/app/content/site.ts`: `CONTACT_EMAIL`,
  `LEGAL_NAME`, `GOVERNING_STATE`, `PLANT_REVIEWER`.
- A lawyer's read of privacy and terms; the founder story; the current Utah
  rate and participating communities; the HOA wording. Full list in
  [launch-review.md](launch-review.md).
- Plant calls: which Globemallow species, and a photo for Mountain snowberry.
- Flip the draft flags on the reviewed pages.
- A check on a real phone, and a test restore of a database backup.

**To build, next:**

1. **Selling the plan.** Stripe Checkout, one-off payments, no accounts.
   Proposed split, prices to test:
   - Free: report, planner, rebate check.
   - Plan pack ($29–49): "Draw a plan for me", the plan document and email.
   - Reviewed plan ($99–149): the plan pack plus Rachel's review.

   Needs a Stripe test account; ask for the key with the credential form, not
   in chat. Design notes in [plan-pack.md](plan-pack.md).
2. Later: approved photos copied to R2, guides 3 to 6, a server-made PDF,
   tidier Neon branch names (live reads `dev`).

**Parked by decision:** photo upload, while the address estimate gives the
square footage ([scope.md](scope.md)).

**Researched, not started:** moving the API to Bun and SQLite (or Cloudflare
D1). Findings in [bun-sqlite-research.md](bun-sqlite-research.md).

## Working in this repo

- Design rules: `CLAUDE.md` and [design/nativo/README.md](../design/nativo/README.md).
- Checks before a push: `pnpm check` (typecheck and tests).
- Run the site locally: `pnpm --filter @np/web dev`.
- Database changes: write a Drizzle migration in `packages/db`; apply it to
  both Neon branches and record it in `drizzle.__drizzle_migrations`.
- Never put personal emails or keys in the repo.
