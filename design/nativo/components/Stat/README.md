Stat is a small outlined box with a label, a big value and, where it applies, a source.

**You provide:** a label, a value with its unit and the source in plain words.

**Anatomy**
- `border-2` in `line`, `--radius-stat` (16), no shadow. Fill matches its parent, or `gold` for money.
- Label at `--type-caption`. Value in display type at `--type-stat`. Source at `--type-mono-sm`, muted.
- Set stats in a two-column grid, `space-10` apart.

**Do**
- Show the source on every measured value. On phone it may move to a single line under the group.
- Use the long form of a value on desktop ("187 days") and a short one on phone ("187 d") when space runs out.

**Don't**
- Show a value without its unit.
- Use a stat for a range that needs a band. Use the range components in `docs/design-system.md`.

Live example: the "your-ground" window on the landing page.
