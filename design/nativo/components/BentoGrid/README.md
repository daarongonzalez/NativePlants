BentoGrid is the 12-column frame that holds every tile on a Nativo page.

**You provide:** the tiles as direct children, each with a column span (4, 5, 6, 7, 8 or 12) and, if taller than one row, a row span of 2.

**Use it for**
- Any page or section that shows several distinct ideas side by side.
- Width `layout-content-width`, 12 columns, `layout-gutter` between tiles, rows `layout-row` tall.

**Do**
- Fill each row to 12 columns, or leave an open bay of 4 or more columns on purpose.
- Keep `space-64` between one grid and the next section.
- Below 1024px switch to 6 columns; below 640px stack to one column with `space-16` gaps.

**Don't**
- Offset, overlap or rotate tiles.
- Fill every cell. The empty ground is part of the design.
- Put more than three filled tiles in one view.
