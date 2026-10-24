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

Two product needs sit on top of Nativo:

- **Confidence** is shown with green (measured), gold (survey estimate) and
  clay (modelled), always beside its written label.
- **Warnings** for toxic or invasive plants use clay. Nativo has no separate
  alert colour, so keep clay off ordinary emphasis on those screens.

## Signature components

These are the ones no generic design system has, because they come from this
subject.

### Attributed value
Value, unit, confidence chip, source line. Every resolved field in a site
profile renders through it. Confidence is shown by colour and a written label.

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
Common name in display, scientific name in italic, the engine's headline,
component reasons, tags, and a toxicity band when one applies.

Rejected plants are shown, not hidden. "We considered 140 and ruled out 96
because your soil is alkaline" is more trustworthy than a short unexplained
list, and it teaches someone what their ground is like.

## What is not decided yet

- Photography treatment. Plant images are a major asset and their crop, ratio
  and background handling should be settled before the first curation pass, not
  after.
- Logo and wordmark. Nativo has none yet.
- How measured values and scientific names are set, since Nativo has no
  monospace face.
- Whether a dark theme is needed. Nativo is light only.
- A colour for the soil horizon column. Nativo allows no extra hues.
- Print and PDF styling for the saved plant list a gardener takes to a nursery.
- Map and pin-drop styling for the address confirm screen.
