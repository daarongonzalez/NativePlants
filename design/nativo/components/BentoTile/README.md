BentoTile is the outlined container for one idea inside a BentoGrid.

**You provide:** a title, optional supporting text, optional media (image, number or list) and a fill: `cream` (default), `green`, `gold` or `clay`.

**Anatomy**
- `border-1` in `line`, `radius-lg`, `space-32` padding.
- Title in `heading-h5` at the top left. Supporting text in `text-regular`, `space-8` below. Media at the bottom, `space-16` clear of the text, rounded with `radius-md`.

**Text on each fill**
- `cream`: `ink`. `green`: `on-green` (cream), or `gold-light` for a warm accent. `gold`: `on-gold` (ink). `clay`: `on-clay` (cream).

**Do**
- Make most tiles `cream`. Use `gold` once per view.
- Keep one idea per tile.
- Give interactive tiles a `border-2` focus ring, offset 2px.

**Don't**
- Add shadows, gradients or colored borders.
- Round the tile more than `radius-lg`.
- Put black text on `green` or `clay`.
