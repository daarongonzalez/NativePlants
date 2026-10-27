# Draft plant values: what to check first

Status: 27 October 2026. For Rachel.

All 33 rows in `data/plants/wasatch-plants.csv` were drafted by Claude from
general horticultural knowledge, to give the review a starting point. **Nothing
was checked against a source, and no row has been reviewed by a person.**

Every row says so: `curated_by` reads "Claude draft (unreviewed)" and
`review_status` is `draft`. Drafts are stored but never shown to gardeners. To
take a row live, replace the curator with your name and change the status. A
test stops anyone publishing a row that still carries the draft label.

## The one that matters most

**An empty `toxicity_note` means "not checked", not "safe".** The importer reads
an empty note as no warning. Notes were written for the plants where a risk is
well known (milkweed, chokecherry, elderberry, columbine, Gambel oak, yarrow,
snowberry, skunkbush sumac), but the absence of a note on any other row is not a
claim that the plant is safe for children and pets. Please look at every row.

## Where the drafts are least certain

- **Cold-end hardiness zones**, especially Palmer's penstemon (4b), purple sage
  (5a), Apache plume (5a) and blue elderberry (4a). The Wasatch Front is 6a to
  7b, so the warm end rarely matters here and the cold end decides.
- **Red-osier dogwood.** Its pH range tops out at 7.8, below the Wasatch Front
  average of about 7.9, because it tends to yellow in alkaline soil. The engine
  will mark it down or rule it out for most yards. That may be right.
- **Native status.** Four are marked `regionally_native` because their natural
  range barely reaches, or does not reach, the Wasatch Front: Palmer's
  penstemon, Apache plume, prairie coneflower and blue grama.
- **Deer resistance.** Browse species (mountain mahogany, bitterbrush, sumac,
  serviceberry, chokecherry, elderberry, currant, oaks, maples, big sagebrush)
  are marked `no`. Most others are marked `yes`; "resistant" is not "proof",
  and local pressure varies.
- **Edible.** Five rows are marked `yes` (serviceberry, chokecherry, elderberry,
  golden currant). Ornamental comes first, so these can wait. Several need safe
  preparation, which the toxicity notes mention only briefly.
- **Mature size.** One number each. Many of these vary a lot by variety and by
  site.
- **Bloom months** for the shrubs and grasses whose flowers are small.
- **Drainage and water use.** Inferred from where each plant grows in the wild.
  Water-use classes have not been matched to Localscapes categories.
- **Sun hours.** Sun lovers use a maximum of 24 (see
  [Plant curation](plant-curation.md)). Part-shade plants use real ranges.

## What the drafts do in the scoring engine

Run against a typical Salt Lake valley yard (alkaline clay, "moderately well
drained", pH 8.0), with all 33 treated as if published:

- **23 are recommended and 10 are ruled out**, all ten on drainage: the very dry
  natives (sulphur-flower buckwheat, globemallow, evening primrose, alumroot,
  purple sage, rabbitbrush, mountain mahogany, Apache plume, bitterbrush, Indian
  ricegrass). Drainage is a hard rule, so a yard the survey calls moderately well
  drained never sees them. That is probably right for the driest plants, but it is
  a strict rule, and many gardeners raise or amend a bed. Worth your view on
  whether drainage should rule a plant out or only lower its score.
- **Big sagebrush comes out on top** for that yard. It fits the soil, sun and
  zone well, but it is not what anyone plants in a front garden. The engine ranks
  fit to the ground, not suitability for a home garden. That judgement belongs in
  the sheet (see "What was left out" below) or in a future column.
- **Sun is a gentle rule.** At "part sun" (4.5 hours) the sun lovers still outrank
  the part-shade plants, because falling 1.5 hours short costs a plant only a
  small part of its score. A part-shade gardener may therefore be shown mostly sun
  plants. Whether that is acceptable, or the sun rule should be stricter, is a
  question for you.

## What was left out

Every plant that is not a good fit for a home garden has not been screened out
here. That judgement, along with whether each species is available from local
nurseries, is part of the review.
