Nativo is earthy and grounded: deep green, clay and gold on a warm cream ground, drawn with plain 1px ink outlines. It should feel like an open field with a vineyard's solid rows and lines: spacious, and clearly structured. Keep it flat. No shadows, no gradients, no pure white.

## Color
- Build every page on `cream`. Set text in `ink`.
- Use `green` as the lead color: headers, primary buttons, large fills. Text on it is `on-green` (cream, 5.9:1). Never ink on green (3.2:1).
- Use `gold` as the warm accent, one call-out per view. Text on it is `on-gold` (ink, 11.3:1).
- Use `clay` for emphasis, errors and warm fills. It reads as text on cream (4.9:1). Text on a clay fill is `on-clay` (cream, 4.9:1). Never ink on clay (3.9:1).
- Set warm text or icons on a `green` fill in `gold-light` (4.6:1). Never plain `gold` on green for text (3.5:1). Never `gold-light` on cream (1.3:1).
- Do not add other hues. Five colors and one light gold are the whole palette; the `on-` and `line` tokens are aliases.

## Type
- Set titles in `heading-h4` and sub-titles in `heading-h5`. Both are Anta, which has one weight. Never bold it.
- Set body copy in `text-regular`, introductions in `text-medium`, and emphasis in `text-regular-medium`.
- Load Anta and Anaheim from Google Fonts. The stacks in `--font-display` and `--font-body` fall back to the system sans.
- Keep line heights as the styles set them: 1.3 for h4, 1.4 for h5, 1.5 for text.

## Borders
- Outline every tile, card, input and panel with `border-1` in `line`. Structure comes from lines and open ground, never from shadows or tints.
- Keep the outline on filled tiles (`green`, `gold`, `clay`) too, so the whole grid reads as one set of lines.
- Divide rows inside a tile with a `border-1` line along the bottom of each row.
- Use `border-2` only for focus rings and the selected state. A focus ring is solid `line`, offset 2px: 18.9:1 on cream, 3.2:1 on green and 3.9:1 on clay.
- Keep every border ink. Do not use colored, dashed, dotted or double borders.

## Corner radius
- Round bento tiles and cards with `radius-lg`. It is deliberately modest; do not go larger.
- Round badges, buttons, dots and any image or screenshot inside a tile with `radius-md`.
- Round swatches, chips and inputs with `radius-sm`.
- Keep the page, full-width bands and tables square with `radius-none`.
- Make a child's radius smaller than its parent's. Do not use pills or circles for containers; round shapes appear only as 8px dots.

## Space
- Space content on the `space-` steps. A tile has `space-32` padding on every side.
- Leave `space-24` (`layout-gutter`) between tiles, `space-40` between a section heading and its grid, and `space-64` between page sections and between separate bento groups.
- Inside a tile, put `space-8` between the title and its text and `space-16` between the text and any media.
- Set secondary labels at `opacity-muted`.

## Bento layout
- Frame the grid at `layout-content-width` (1312px): 12 columns of about 87px, `layout-gutter` (24px) between tiles on both axes, rows `layout-row` (176px) tall. The page is `layout-page-width` (1440px) with `space-64` padding.
- Size tiles in whole columns and rows: 4, 5, 6, 7, 8 or 12 columns wide, 1 or 2 rows tall. Fill each row to exactly 12 columns, or leave the rest open on purpose.
- Anchor every tile to the grid lines. Do not offset, overlap, rotate or let media cross a tile's border.
- Keep it quiet: most tiles are `cream`. Use at most three filled tiles in a view, lead with `green`, use `gold` once, and never place two tiles of the same fill so they share an edge.
- Leave breathing room: in any three rows, leave at least one open bay of 4 columns or more with no tile, and let the first row carry the lead tile with the most space.
- Build each tile as one idea: title in `heading-h5` at the top left, supporting text in `text-regular` below it, media or data at the bottom. Align everything to the left.
- Below 1024px, use 6 columns: tiles of 4 columns pair up (3 of 6) and every other tile spans all 6. Below 640px, stack every tile full width with `space-16` gaps and `space-24` page padding.

## Illustrations
- Draw from four sets under Assets: Tree (2), Branch (13), Grass (12) and Leaf (9). Each drawing comes in `green` for cream and gold grounds and in `cream` for green and clay grounds.
- Place one drawing per tile, at the bottom as its media, left-aligned and no wider than half the tile.
- Use them as given. Do not recolor, stretch, crop or rotate them.

## Components
- Use `BentoGrid` for the frame, `BentoTile` for each tile and `Badge` for labels. Use them before drawing a new container.
- Each has a live preview and its own guidelines under Components.

## Logo and icons
- No logo has been provided. Write the name "Nativo" in `heading-h4`, `ink`, until one exists.
- No icon set has been chosen. Color lists use a 16px droplet in `ink` at `opacity-muted` beside each token name. Draw icons in `ink` or `green` on cream.
