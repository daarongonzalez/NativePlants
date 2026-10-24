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

## Where to start

`data/plants/candidates.csv` lists 33 species to consider. They are suggestions
to react to, not a reviewed list. Add, drop and correct freely.

Open decisions that change the work (see the [roadmap](roadmap.md)): ornamental
or edible first, and who the reviewer is.
