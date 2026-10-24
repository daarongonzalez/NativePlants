# Installing the Nativo design system

1. Copy this whole folder into your repo as `design/nativo/`.
2. Add the contents of `CLAUDE.md` (done) to your project's `CLAUDE.md`.
3. Load the two stylesheets once, globally, fonts first:
   - HTML: `<link rel="stylesheet" href="/design/nativo/fonts.css">` then `<link rel="stylesheet" href="/design/nativo/tokens.css">`
   - Any bundler: `import "design/nativo/fonts.css"; import "design/nativo/tokens.css";` (adjust the path to your setup)
4. Open `design/nativo/components/BentoGrid/preview.html` in a browser to check that the tokens and fonts load.

## What is inside
- `README.md`: the brand book and usage rules. Read this first.
- `tokens.json`: every token with its usage note. The source of truth.
- `tokens.css`: the same tokens as CSS variables and type classes (`.heading-h4`, `.text-regular`, and so on).
- `fonts.css`: Anta and Anaheim from Google Fonts.
- `components/`: guidelines and a live preview for BentoGrid, BentoTile and Badge, plus the Cover.
- `assets/`: 36 illustrations (Tree, Branch, Grass, Leaf), each as a green and a cream SVG.

## Keeping it current
`tokens.css` is generated from `tokens.json`. If you change a token, change it in both files, or ask Claude Code to regenerate `tokens.css` from `tokens.json`.
