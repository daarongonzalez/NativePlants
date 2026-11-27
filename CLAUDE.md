## Design system: Nativo (version 2, set by the landing page)
- Before any UI work, read `design/nativo/README.md`. It holds the rules for colour, type, borders, corner radius, shadows, tilt, space, layout and illustrations.
- The landing page in `apps/web` is the reference build. When a rule is unclear, match it.
- Load these four stylesheets once, globally, in this order: `design/nativo/fonts.css`, `design/nativo/tokens.css`, `packages/ui/src/tokens.css`, `packages/ui/src/playful.css`.
- Use only tokens from those files. Do not write raw hex colours, pixel sizes or font names in components. Use the type roles (`--type-h1`, `--type-body` and so on), which change size at the phone breakpoint.
- Build containers from the guides in `design/nativo/components/`: Window, Card, StickyNote, Button, Badge and Stat. BentoGrid and BentoTile are retired.
- The look: Bricolage Grotesque 800 for display, Anaheim for body, IBM Plex Mono for measured values. 2px ink outlines, pill buttons and inputs, rounded cards, hard offset ink shadows, tilted sticky notes, `paper` surfaces on a `cream` page.
- Never: blurred shadows, gradients, pure white, ink text on `green` or `clay`, or `green` headings on `meadow` (use `green-deep`).
- Take illustrations from `design/nativo/assets/` only. Use the `-green` file on light grounds and the `-cream` file on `green`, `green-deep` and `clay`. Never recolour them.
- Nothing tappable below 44px. Every measured value shows its source.
- If a rule is missing, ask before inventing one.

## Scope for this project
- The Nativo design system, tokens, skills and illustrations belong to this repo only. Never use them in another project.
- Connectors: GitHub and Neon (project `cool-term-95598834`). No Sanity or Figma unless the owner asks.
- Database changes go through Drizzle migrations. Deleting a Neon branch, project or data needs the owner's go-ahead.

## Where the project stands
- Read `docs/status.md` first in a new session. It lists what is live, the accounts and secrets, and what is left. Update it at the end of each piece of work.
