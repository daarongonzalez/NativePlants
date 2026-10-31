# Design System

Status: v0.2, October 2026. Nativo replaces the v0.1 visual language.
Visual rules and tokens: `design/nativo/` (start with `design/nativo/README.md`)

## The problem this language solves

Every number this product shows was measured, estimated, or modelled by someone
else. A pH from a county soil survey is an area average across a map unit that
may span several blocks. A pH from the gardener's own mail-in test is their
actual dirt. Sun hours calculated from latitude ignore the neighbour's oak tree
entirely.

Those are different claims, and a design that renders them identically is
lying by omission. **Making confidence and provenance visible is the job.**
Everything else follows from it.

## Four principles

1. **Never show a value without its source.** No exceptions, no abbreviations,
   no source keys shown to users.
2. **Ranges, not points.** Frost is a probability band. Plant tolerance is a
   span with an optimum. A single date or a single ideal value throws away what
   the gardener needs to decide.
3. **Readable in a yard, in gloves, in sun.** Nothing tappable below 44px.
   Semantic state carries shape or border as well as colour, so it survives
   glare, greyscale, and colour blindness.
4. **Plain words, gardener's vocabulary.** "County soil survey," never `ssurgo`.

## Visual language: Nativo

Colour, type, borders, corner radius, space, layout and illustration all come
from the Nativo design system in `design/nativo/`. This document keeps the
product principles and the components that are specific to this subject. It
does not repeat Nativo's rules.

Four product needs sit on top of Nativo. They live in
`packages/ui/src/tokens.css`, load after Nativo's own files, and are the only
exceptions to Nativo's rules.

- **Measured values in mono.** IBM Plex Mono with tabular figures marks "this
  is a measurement" everywhere. It is why a plant's scientific name is mono
  italic and its common name is not.
- **Dashed border for low confidence.** Confidence is green (measured), gold
  (survey estimate) and clay (modelled), always beside its written label. Low
  confidence also gets a dashed outline so it survives glare and colour
  blindness. Nativo otherwise allows solid borders only.
- **A separate warning colour.** Toxic and invasive plant warnings use
  `--np-warn`, a deeper red-brown than clay, so a real warning never looks
  like ordinary emphasis.
- **Soil horizon ramp.** Six browns matched to the depth bands. The ramp is
  data, not decoration; use it for the soil column and nothing else.

## Playful direction (landing page 2a, October 2026)

The landing page design (handoff "2a Combined" and "2a Mobile") sets the look
for the app going forward. It keeps Nativo's palette core, Anaheim body type,
ink outlines and the illustrations, and departs from the base system in the
ways below. The tokens live in `packages/ui/src/playful.css`, which loads
after the other three stylesheets.

- **Display font.** Bricolage Grotesque 800 replaces Anta for headings,
  buttons, badges and figures. Never use it below 800.
- **Rounded corners.** Cards 24px, windows 28–32px, sticky notes 16–20px, stat
  boxes 16px. Buttons, inputs, badges and chips are pills.
- **Hard offset shadows.** No blur, always ink: 4px on the nav, 5px on forms,
  5–6px on cards, 8px on the two hero windows, 2–3px on small buttons. A
  pressed button moves 2px into its shadow.
- **2px outlines.** Every card, window, input, button and band edge uses
  `border-2`. Dashed borders appear only on placeholder art (Sage) and the
  calculator's divider.
- **More light colours.** `paper` (cards and inputs, never pure white),
  `sand`, `meadow`, `sky`, `peach` and `green-deep` for headings on meadow.
  `soil`, the two lawn greens and the seed colours are for the plot planner
  only.
- **Tilt.** Sticky notes and the opening badge rotate between −3° and +2°.
  Nothing else tilts.
- **Window cards.** A card with a 44–48px title bar and a mono label, like a
  file name. Use them for interactive tools and for the three answers.

Type sizes and page spacing are role tokens (`--type-h1`, `--page-gutter`)
that change at the 768px breakpoint, so components name a role rather than
a size.

Still to settle: Sage needs character art (a dashed placeholder for now), and
the HOA law wording needs checking before launch.

## Signature components

These are the ones no generic design system has, because they come from this
subject.

### Attributed value
Value, unit, confidence chip, source line. Every resolved field in a site
profile renders through it. Low confidence carries a dashed border as well as colour.

### Range against a marker
A plant's tolerance span with its optimum, plus a marker for the gardener's
actual site value. Recurs for pH, sun, zone, and water. One glance answers
"will this work here?"

### Soil horizon column
Vertical bands proportional to real depth, paired with per-horizon values. The
thin surface layer reads as thin, which makes the point that most gardening
happens in the top 30 cm without a caption.

### Frost probability band
The 10 / 50 / 90 percent spread on one track. Planting on 9 April is a
different bet than planting on 8 May, and that choice belongs to the gardener.

### Plant card
Common name in display, scientific name in mono italic, the engine's headline,
component reasons, tags, and a toxicity band when one applies.

Rejected plants are shown, not hidden. "We considered 140 and ruled out 96
because your soil is alkaline" is more trustworthy than a short unexplained
list, and it teaches someone what their ground is like.

## What is not decided yet

- Photography treatment. Plant images are a major asset and their crop, ratio
  and background handling should be settled before the first curation pass, not
  after.
- Logo. The playful direction sets the name "nativo" in Bricolage Grotesque
  as a stand-in wordmark.
- Dark theme. Nativo and these additions are light only.
- Print and PDF styling for the saved plant list a gardener takes to a nursery.
- Map and pin-drop styling for the address confirm screen.
