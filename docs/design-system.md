# Design System

Status: v0.1, September 2026.
Visual reference: https://claude.ai/code/artifact/95411f74-bb7a-44d3-83d2-df058dd3e59b
Tokens: `packages/ui/src/tokens.css`

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

## Colour: three palettes, three jobs

**Ground, ink and accent.** Neutrals carry a slight green bias so they read as
chosen rather than inherited. The accent is chicory blue — the alkaline end of
a soil pH strip, and the colour of the chicory and asters that thrive in exactly
that soil. Deliberately not garden green.

**Confidence.** Three levels — measured, survey estimate, modelled — kept
entirely separate from the accent hue. These are the most-used colours in the
product. Reaching for the warning colour to make something stand out would make
a real toxicity warning mean less.

**Soil horizon ramp.** Six values mapped to the exact depth bands SSURGO
reports. Perceptually ordered. **This ramp is data, not decoration** — using a
horizon colour elsewhere would make the report lie.

## Typography

- **Fraunces** for display. It reads as 19th-century botanical plate printing,
  the right ancestry for a plant reference.
- **IBM Plex Sans** for interface.
- **IBM Plex Mono** for every measured value, always with `tabular-nums`.

Mono is not a style choice. It consistently marks "this is a measurement"
across the whole product, which is why a plant's scientific name is set in it
and its common name is not.

## Signature components

These are the ones no generic design system has, because they come from this
subject.

### Attributed value
Value, unit, confidence chip, source line. Every resolved field in a site
profile renders through it. Low confidence carries a dashed border as well as
colour.

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

## Theme handling

Every colour is declared in the bare `:root` block before any media query or
`[data-theme]` block redefines it. A colour defined only inside a dark-mode
block never applies in the default un-stamped state, which is what most people
see — that is the classic unreadable-page bug and the token file is structured
to prevent it.

## What is not decided yet

- Photography treatment. Plant images are a major asset and their crop, ratio
  and background handling should be settled before the first curation pass, not
  after.
- Logo and wordmark.
- Print and PDF styling for the saved plant list a gardener takes to a nursery.
- Map and pin-drop styling for the address confirm screen.
