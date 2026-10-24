# Plant curation

The plant list is the part of this product that cannot be copied by writing
more code. Every row is advice a gardener acts on, so it needs a real person's
name on it.

## How it works

1. Edit the plant sheet (a spreadsheet is fine).
2. Export it as CSV to `data/plants/wasatch-plants.csv` and open a pull request.
   The change history is the record of who decided what.
3. After merging, run **Actions → Run ingestion** and choose `plants`.

The import checks every row. If any row has a problem, **nothing is loaded** and
every problem is listed with its row number. Fix them all and run it again.

Only rows marked `published` are shown to gardeners.

## Columns

| Column | What goes in it |
|---|---|
| `scientific_name` | Latin name. One row per species, no repeats. |
| `common_names` | One or more, separated by `\|` |
| `family` | Plant family |
| `ph_min`, `ph_optimum`, `ph_max` | Soil pH range and best value, in order |
| `sun_min_hours`, `sun_max_hours` | Direct sun hours per day it needs |
| `water_use` | `very_low`, `low`, `moderate` or `high` |
| `drainage_tolerated` | One or more of `excessively_drained`, `somewhat_excessively_drained`, `well_drained`, `moderately_well_drained`, `somewhat_poorly_drained`, `poorly_drained`, `very_poorly_drained`, separated by `\|` |
| `zone_min`, `zone_max` | Hardiness zones such as `4b`, coldest first |
| `mature_height_cm`, `mature_width_cm` | Size at maturity |
| `bloom_start_month`, `bloom_end_month` | 1 to 12, both or neither |
| `native_status` | `native`, `regionally_native`, `adapted` or `introduced` |
| `deer_resistant`, `edible`, `good_for_cutting` | `yes` or `no` |
| `pollinator_value` | `none`, `low`, `moderate` or `high` |
| `toxicity_note` | Leave empty only if the plant is safe. A note here always shows as a warning. |
| `curated_by` | Name of the person responsible. Required once a row is not a draft. |
| `review_status` | `draft`, `reviewed` or `published` |

## How sun is matched

`sun_min_hours` and `sun_max_hours` are hours of **direct sun the spot gets**.

Unless a gardener tells us how sunny their spot is, we use a calculated number:
the length of the longest day at their latitude (about 15 hours in Salt Lake
City), assuming nothing shades it. That is a ceiling, not a measurement. So:

- **A plant that loves full sun** should have a `sun_max_hours` high enough to
  never count against it, such as 24. Otherwise a sunny, unshaded yard would
  show "more sun than it prefers" for a plant that is happiest there.
- **A plant that wants shade or part sun** gets a real range, such as 3 to 6.
  It will score poorly on an assumed-sunny yard and well once the gardener says
  "part sun". That is the intended behaviour.

When a gardener does answer, we use one number per choice: full sun (6+ hours)
counts as 8, part sun (3 to 6) as 4.5, shade (under 3) as 2.

## For Rachel: what to review

In rough order of importance:

1. **The candidate list.** `data/plants/candidates.csv`. Is each a good fit for
   Wasatch Front home gardens, and is the native status right? Ornamental comes
   first, so the edible-tagged rows can wait.
2. **The tolerance ranges** you fill in. Every range is a claim a gardener acts
   on. Where you are unsure, leave the row as `draft`.
3. **The sun numbers above** (8, 4.5 and 2 hours), and the "24 for sun lovers"
   convention.
4. **The soil depth.** We report the top 30 cm (12 inches) of soil. Is that the
   right layer for the plants on the list?
5. **The wording of reasons** shown to gardeners, such as "Your soil pH of 7.9
   is close to ideal for this plant." They live in
   `packages/engine/src/score.ts`.

Your name goes in `curated_by` for every row you take responsibility for. Rows
you have not signed off on stay `draft` and are never shown to gardeners.

## Where to start

`data/plants/candidates.csv` lists 33 species to consider. They are suggestions
to react to, not a reviewed list. Add, drop and correct freely.

Open decisions that change the work (see the [roadmap](roadmap.md)): ornamental
or edible first, and who the reviewer is.
