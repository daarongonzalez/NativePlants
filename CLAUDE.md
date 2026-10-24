## Design system: Nativo
- Before any UI work, read `design/nativo/README.md`. It holds the rules for color, type, borders, corner radius, space, the bento layout and illustrations.
- Use only the tokens in `design/nativo/tokens.css`. Do not write raw hex colors, pixel spacings or font names in components.
- Load `design/nativo/fonts.css` and `design/nativo/tokens.css` once, globally.
- Build every container from the guidelines in `design/nativo/components/` (BentoGrid, BentoTile, Badge). Open each `preview.html` in a browser to see it.
- Take illustrations from `design/nativo/assets/` only. Use the `-green` file on cream and gold, the `-cream` file on green and clay. Never recolor them.
- No shadows, no gradients, no pure white. Keep tiles on the grid in `layout-*` tokens.
- If a rule is missing, ask before inventing one.
