# NativePlants — Design Brief

A single-page summary of the project for designers and design tools. It is
written to stand alone: you should not need any other file to start.

Status: October 2026. NativePlants is a working name. The final name, logo and
wordmark are not decided.

---

## 1. What this is

A planning tool for home gardeners. A person types their address and gets back
the truth about that exact patch of ground, then a short list of plants that
will actually live there.

- **Input:** a street address.
- **Output:** their hardiness zone, their frost dates as a range, their soil,
  and plants that suit those conditions, each with a plain reason.
- **Why it is different:** most garden tools filter by ZIP code or show a
  photo-realistic render. This one says where each number came from and how
  sure it is. It can tell a gardener on a hillside that the nearest weather
  station is lower than their yard, so their last frost is probably later than
  the number shown.

## 2. Who it is for

- Home gardeners, community gardeners, and anyone growing flowers or produce in
  their own yard.
- They are often **standing in the yard** when they use it: on a phone, in
  bright sun, sometimes wearing gloves.
- They are not soil scientists. They want a clear answer, and they will trust it
  more if it shows its working.

## 3. Where it launches

One area only, on purpose: the **Wasatch Front in Utah** (Salt Lake, Utah,
Davis and Weber counties). It is better to give excellent advice in one place
than shallow advice everywhere.

Real examples to use in mockups:

| Place | Hardiness zone |
|---|---|
| Downtown Salt Lake City (84101) | 7b |
| Ogden (84401) | 7a |
| Bountiful (84010) | 6b |
| Provo (84604) | 6b |

Frost example, Salt Lake City airport (30-year normals):

- Last spring frost: 31 Mar (frost is still likely after this), 21 Apr (even
  odds), 9 May (only about a 1 in 10 chance of frost after this).
- First fall frost: 9 Oct (only about a 1 in 10 chance of frost before this),
  24 Oct (even odds), 6 Nov (frost has very likely arrived by now).
- About 187 frost-free days.

These are the 90, 50 and 10 percent points on one track. A gardener planting
tender seedlings on 9 April is taking a different bet than one planting on
8 May.

Elevation example: the Salt Lake airport station sits at 1,288 m. Downtown is
about 1,300 m, the Bountiful bench is about 1,511 m, and Park City is about
2,138 m.

## 4. The core idea behind every screen

**Never show a value without saying where it came from and how sure we are.**

Every number is measured, estimated or modelled by someone else. A soil reading
from a county survey is an average across a few blocks. A reading from the
gardener's own soil test is their actual dirt. Showing them the same way would
be misleading. Making the difference visible is the main job of the design.

Four principles:

1. **Value plus source, always.** No exceptions. Never show a technical source
   name to a gardener.
2. **Ranges, not single points.** Frost is a spread of probabilities. A plant's
   tolerance is a span with a best point inside it. One date or one ideal value
   throws away what the gardener needs to decide.
3. **Readable in a yard.** Tap targets at least 44px. Meaning is never carried
   by colour alone: use shape or border as well, so it survives glare and
   colour blindness.
4. **Plain words.** Say "County soil survey", not a database name.

### How sources are described to gardeners

| Show this | Instead of |
|---|---|
| County soil survey | the soil database name |
| Regional soil map | a coarser soil database name |
| NOAA 30-year normals | frost data source key |
| USDA hardiness map | zone data source key |
| Calculated from your latitude | sun model |
| You told us | user-reported value |
| Your soil test | uploaded soil test |

### The three confidence levels

| Level | Label shown | Meaning |
|---|---|---|
| High | Measured | Taken at this spot |
| Medium | Survey estimate | An average across the surrounding area |
| Low | Modelled | Calculated, not observed |

Low confidence carries a **dashed border** as well as its colour.

## 5. What is in the first release

Included:

- Address entry with a draggable map pin
- Hardiness zone
- Frost dates as 10 / 50 / 90 percent bands
- Soil pH, texture and drainage
- Sun hours: asked as one question (see below), calculated and marked as
  modelled until the gardener answers
- A few optional questions (deer, pets, children, watering, HOA rules)
- **The site profile report**, which is the hero screen
- 60 to 100 plant recommendations, each with a plain-language reason
- Goal filters: pollinators, low water, deer resistant, cut flowers, edible
- A saved plant list that can be printed and taken to a nursery
- A way for a gardener to tell us a value is wrong

Not in the first release (please do not design these yet):

- Garden layout or bed drawing
- Photo upload or analysis
- Nursery accounts, stock or checkout
- Payments
- Native mobile apps
- AI chat
- Rebate finder (only a simple display line for Utah's statewide program)
- Anywhere outside the Wasatch Front

## 6. The screens

Sign-in is needed only to save. Everything before that is open, so a first-time
visitor gets an answer with no signup wall.

1. **Landing.** One honest sentence about what this is and an address field.
2. **Address confirm.** A map with a draggable pin. Say briefly why it matters:
   soil changes within a single block.
3. **Site profile.** The hero. See section 7.
4. **Questions.** Five or six, all skippable.
5. **Recommendations.** Ranked plant cards, each with its reason. Filter chips
   for goals. Plants we ruled out are shown too, with the reason, for example
   "We considered 140 and ruled out 96 because your soil is alkaline."
6. **Plant detail.** Photo, tolerance ranges shown against this site's values,
   bloom window, wildlife value, and a clear warning where a plant is toxic.
7. **Saved list.** Printable. This is what a gardener takes to a nursery.

Every screen needs **empty, loading and error states**, and a **mobile layout**
designed first.

## 7. The hero: the site profile report

This is the screen people will screenshot and share. It should look like
something a soil scientist handed them, not a table of numbers. It deserves real
design time.

It shows:

- **Soil horizon column.** Vertical bands in proportion to real depth, next to
  the values for each layer. The thin top layer should look thin. That makes the
  point that most gardening happens in the top 30 cm, with no caption needed.
- **pH, texture and drainage,** each as a value with its source and confidence.
- **Hardiness zone.**
- **Frost probability band.** The 10 / 50 / 90 percent dates on one track, so a
  gardener sees that planting on 9 April is a different bet than planting on
  8 May.
- **Sun hours.** Marked as calculated until answered, then as reported by the
  gardener. See the sun question below.
- **Plain caveats.** For example: "The nearest weather station is 900 ft lower
  than your address, so your last frost is likely later than this."

### The sun question

One question with three answers and a way out. It appears on the report next to
the sun value, and anywhere a gardener sees the "calculated" label.

- **Prompt:** "How much sun does this spot get on a summer day?"
- **Most of the day:** about 6 hours or more of direct sun.
- **Part of the day:** about 3 to 6 hours.
- **Mostly shade:** under 3 hours.
- **Not sure yet:** keeps the calculated value, with a plain note that it
  assumes nothing shades the spot.

Each answer carries a one-line "how to tell" in things a person can see (the
north side of a house, under dense trees). Wording is final copy in
`packages/shared/src/sun-question.ts`. The answer is saved on the site, and
answering changes the value's label from "calculated" to "you told us".
Tap targets are 44px or larger, and the selected state uses a border as well as
colour.

## 8. Signature components

These are the ones a generic design system would not have.

- **Attributed value.** The value, its unit, a confidence chip and a source line.
  Every value in a profile uses it.
- **Range against a marker.** A plant's tolerance span with its best point, plus
  a marker for this gardener's actual value. Used for pH, sun, zone and water.
  One glance answers "will this work here?"
- **Soil horizon column.** As described above.
- **Frost probability band.** As described above.
- **Plant card.** Common name in the display face. Scientific name in monospace
  italic. A headline reason, the reasons behind it, tags, and a toxicity band
  when one applies.

## 9. Visual language (already started)

All values below exist as design tokens in `packages/ui/src/tokens.css`, with a
matching dark theme.

**Mood.** A botanical reference book crossed with a field spec sheet.
Restrained, calm and exact.

**Colour: three palettes, each with one job.**

- **Ground, ink and accent.** Neutrals with a slight green tint. The accent is a
  chicory blue (`#2E5C7A`), chosen because it matches the alkaline end of a soil
  pH strip and the flower that thrives in that soil. It is deliberately not the
  obvious garden green.
- **Confidence.** Green for measured (`#4A7C3F`), amber for survey estimate
  (`#8A6D1F`), brown for modelled (`#8A5A3C`). Kept completely separate from the
  accent. Do not reuse them for emphasis.
- **Soil horizon ramp.** Six browns, dark at the surface to pale at depth,
  matched to real depth bands (0–5, 5–15, 15–30, 30–60, 60–100, 100–200 cm).
  **This ramp is data, not decoration.** Never use it for anything else.
- **Alert.** A single red-brown (`#9C3D26`) reserved for toxicity and invasive
  species warnings. Never for emphasis.

**Type.**

- **Fraunces** for display. It reads like 19th-century botanical plate printing.
- **IBM Plex Sans** for the interface.
- **IBM Plex Mono** for every measured value, always with tabular figures. Mono
  signals "this is a measurement". It is why a plant's scientific name is mono
  and its common name is not.
- Scale: 1.25 ratio, from 12px up to 48px.

**Shape and space.** A 4px spacing base. Corners are small (2, 3 and 6px) on
purpose. Border, fill, radius and shadow each say "separate object", so using
all of them on every block flattens the hierarchy.

**Motion.** Short and quiet: 160ms with a gentle ease.

**Themes.** Light and dark. Every colour is defined in the base theme first, so
the page is readable before any theme choice is made.

## 10. Tone of voice

- Plain, warm and exact. Not casual, not technical.
- Say what we know and how well we know it.
- Explain one idea at a time, in a gardener's words.
- Never use a technical source name or database term in the interface.
- Warnings about toxic or invasive plants are direct and never softened.

Plain-language explainers are needed for pH, soil texture, drainage class and
frost probability bands. They are the teaching layer and also a good search
entry point.

## 11. What is decided and what is open

**Decided**

- Colour, type and spacing tokens (above)
- The principles in section 4
- The seven screens and their order
- The five signature components
- The first launch area

**Open: please propose options**

- Name, logo and wordmark
- The look of plant photography (crop, ratio and background). This needs
  settling before plants are photographed or licensed.
- Map and pin styling for the address confirm screen
- Print and PDF layout for the saved list
- The texture triangle for soil, if it earns its place
- Empty, loading and error states
- Onboarding copy and the advice disclaimer (needs a legal review)

## 12. Constraints to design within

- **Phone first.** Most use is in the yard.
- **Accessibility.** Tap targets of 44px or more, meaning never carried by
  colour alone, and readable contrast in both themes.
- **Privacy.** We collect home addresses. Say so plainly and keep it minimal.
  There is no photo upload in the first release, so no upload control.
- **Honesty about data.** If a value is missing or low confidence, show that
  directly. A confident-looking number we did not measure is worse than none.

## 13. What data is real today

For realistic mockups, the data behind these is live now:

- Hardiness zones for 85 Wasatch Front ZIP codes
- Frost dates for 45 weather stations
- Address lookup and elevation

Not built yet: soil data, the plant catalogue and the recommendation list. Use
plausible placeholder content for those, and mark it as such.

---

Longer background, if needed:

- `docs/design-system.md` for the reasoning behind the visual language
- `docs/v1-spec.md` for the full specification
- `docs/scope.md` for the authoritative in-scope and out-of-scope list
