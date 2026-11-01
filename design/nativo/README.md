Nativo is earthy, warm and a little playful: deep green, gold and clay on a warm cream ground, drawn with chunky 2px ink outlines and hard ink shadows. It should feel like a friendly farming game laid over real data: cozy and inviting, but clearly structured and honest about its numbers.

The landing page (`apps/web`) is the reference build. When a rule here is unclear, match it.

Version 2, October 2026. Version 1 (flat, 1px lines, Anta, bento grid) is retired.

## Where the tokens live
- Load four stylesheets once, globally, in this order: `design/nativo/fonts.css`, `design/nativo/tokens.css`, `packages/ui/src/tokens.css`, `packages/ui/src/playful.css`.
- `design/nativo/tokens.css`: the core palette, base spacing, radius, borders and type families.
- `packages/ui/src/tokens.css`: product data tokens (mono face, warning colour, soil ramp, touch size).
- `packages/ui/src/playful.css`: the light colours, radii, shadows, tilt, extra spacing, sizes and responsive type roles.
- Components use tokens only. No raw hex colours, pixel sizes or font names.

## Color
- Build every page on `cream`. Set text in `ink`.
- Use `paper` for every card, window, input and nav surface. It is the lightest colour in the system. Never use pure white.
- Use `green` as the lead colour: primary buttons, accent words in headings, section headings on cream, and the closing band. Text on it is `paper` (6.3:1). Never ink on green (3.2:1).
- Use `green-deep` for headings and big figures on `meadow`, `peach` and `sky`, and for title bars on green cards. Text on it is `paper` (10.5:1).
- Use `gold` for money and for the selected state: rebate cards, the selected seed, secondary buttons. Text on it is `ink` (11.2:1).
- Use the light grounds to separate sections and notes. All take `ink` text:
  - `meadow`: a full-width band, sticky notes, tags. Headings on it are `green-deep`, never `green` (3.8:1).
  - `sand`: a full-width band and the default window title bar.
  - `sky`: speech bubbles, badges and sticky notes.
  - `peach` (the same value as `gold-light`): sticky notes.
- Use `clay` for list bullets and errors. It reads as text on cream (4.9:1).
- Keep `soil`, the two lawn greens and the seed colours for the plot planner. The soil horizon ramp is data, never decoration.
- Do not add other hues.

## Type
- Set display type in Bricolage Grotesque at weight 800, through `--font-display`: headings, buttons, badges, the wordmark and big figures. Never use it at another weight.
- Set body copy in Anaheim (`--font-body`). Set every measured value, every scientific name, window labels and sources in IBM Plex Mono (`--np-font-mono`).
- Use the type roles in `playful.css`, not sizes. Each role has a desktop and a phone value:
  - `--type-h1` (96 / 54), `--type-h2` (64 / 40), `--type-h3` (30 / 24), `--type-h3-card` (26 / 22)
  - `--type-figure` (88 / 56) for headline numbers, `--type-stat` (30 / 22) for stat boxes
  - `--type-lead` (21 / 18), `--type-body-lg` (18 / 16), `--type-body` (17 / 15), `--type-body-sm` (16 / 15)
  - `--type-button-lg`, `--type-button`, `--type-label`, `--type-caption`, `--type-footnote`, `--type-mono`, `--type-mono-sm`
- Line heights: 0.94 for h1, 1 for h2 and figures, 1.1 for h3 and stats, 1.5 for paragraphs. Labels sit at the font's natural height.
- Write the name "nativo" in lower case, in display type and `green`, until a logo exists.

## Borders
- Outline every card, window, input, button, badge, chip and stat box with `border-2` in `line` (ink).
- Put a `border-2` rule along the top and bottom of every full-width coloured band.
- Use a `border-2` rule under every window title bar.
- Keep borders solid ink. Dashed is allowed in three places only: placeholder art, a divider above a calculator's footnote, and the low-confidence chip.

## Corner radius
- Pills (`--radius-pill`) for buttons, inputs, address forms, badges, chips, the nav bar and list rows.
- Circles (`--radius-round`) for round buttons, number badges, avatars and dots.
- `--radius-window-lg` (32) and `--radius-window` (28) for windows; `--radius-card` (24) for cards.
- `--radius-note` (16) and `--radius-note-lg` (20) for sticky notes; `--radius-stat` (16) for stat boxes; `--radius-seed` (18) for planner slots and bubbles; `--radius-tile` (10) for planner tiles.
- On phone, drop windows and cards one step (to `--radius-card` and `--radius-note-lg`).
- Keep full-width bands square.

## Shadows
- Shadows are hard and offset, never blurred, always ink: `--shadow-2` up to `--shadow-8`.
- Size them by weight: 2–3 for small buttons, seeds and list rows; 4 for the nav and sticky notes; 5 for forms and cards; 6 for windows and big notes; 8 for the one or two hero windows on a page. On phone, use one step smaller.
- A pressed button moves into its shadow: `transform: var(--press)` with `--shadow-1`. A selected item lifts out of it: `var(--lift)` with a larger shadow.
- No blurred shadows, glows or gradients. The only gradient-like fill is the hatch on placeholder art.

## Tilt
- Tilt sticky notes and the opening badge between `--tilt-left-lg` (−3°) and `--tilt-right` (+2°).
- Never tilt windows, cards, buttons, inputs or anything with data a person must read closely.
- Neighbouring notes tilt in opposite directions.

## Space
- Use the `space-` steps (2 to 112). Pages use `--page-gutter` (64 desktop, 20 phone) and `--section-pad` (96 desktop, 48 phone).
- Card padding is `--card-pad` (28 desktop, 20 phone). Windows with a lot inside use `space-36`.
- Leave `space-40` to `space-56` between a section heading and its content.

## Layout
- Frame each section at `layout-page-width` (1440) with `--page-gutter` either side, on a 12-column grid with 24–40px gaps.
- Alternate plain `cream` sections with full-width bands (`meadow`, `sand`, `green`) so the page has a rhythm.
- Windows and cards may stagger: drop a neighbour 20–80px so a row reads as a playful set rather than a table. Keep each item inside its own columns; never overlap two items, except a sticky note that tucks over a window's corner on phone.
- Breakpoints: phone below 768px (the 390px design) and a stacked layout below 1024px. Between designed widths, let the layout flow.
- Nothing tappable is smaller than 44px (`--np-touch-min`).

## Illustrations
- Draw from four sets under Assets: Tree (2), Branch (13), Grass (12) and Leaf (9).
- Use the `-green` file on `cream`, `paper`, `sand`, `meadow`, `sky`, `peach` and `gold`. Use the `-cream` file on `green`, `green-deep` and `clay`.
- Use one drawing per section or card, beside a heading or under a short intro. Give it `alt=""` when it is decoration.
- Use them as given. Do not recolor, stretch, crop or rotate them.

## Components
- Build from the guides under Components: Window, Card, StickyNote, Button, Badge and Stat. Use them before drawing a new container.
- BentoGrid and BentoTile are retired. Do not use them for new work.
- The landing page holds a live example of each: `apps/web/app/components/landing/`.

## Characters
- Sage is the guide character. Sage speaks in a `sky` speech bubble with the name in display type, in `green-deep`.
- Sage's art is not drawn yet. Until it is, show a dashed `green` circle with a hatch and the word "Sage" in mono.
- Sage's voice is warm and a little cheeky, but never wrong about a number.
