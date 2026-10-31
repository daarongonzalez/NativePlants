## Design system: Nativo
- Before any UI work, read `design/nativo/README.md`. It holds the rules for color, type, borders, corner radius, space, the bento layout and illustrations.
- Use only the tokens in `design/nativo/tokens.css`. Do not write raw hex colors, pixel spacings or font names in components.
- Load `design/nativo/fonts.css` and `design/nativo/tokens.css` once, globally.
- Build every container from the guidelines in `design/nativo/components/` (BentoGrid, BentoTile, Badge). Open each `preview.html` in a browser to see it.
- Take illustrations from `design/nativo/assets/` only. Use the `-green` file on cream and gold, the `-cream` file on green and clay. Never recolor them.
- No shadows, no gradients, no pure white. Keep tiles on the grid in `layout-*` tokens.
- If a rule is missing, ask before inventing one.

## Playful direction (the landing page sets the look going forward)
- The landing page (`apps/web`, design handoff 2a) is the approved direction. Where it conflicts with the Nativo rules above, it wins: Bricolage Grotesque 800 for display, rounded corners and pills, hard offset ink shadows (no blur), 2px outlines, the extra light colours, and tilted sticky notes.
- Load `packages/ui/src/playful.css` after the other stylesheets and use its tokens. `docs/design-system.md` lists each departure and where it applies.
- Still no gradients, no blurred shadows and no pure white (use `paper`).
