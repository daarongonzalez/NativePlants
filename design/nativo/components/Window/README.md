Window is a rounded card with a title bar, like a small app window. Use it for interactive tools and for anything that answers "here is your result".

**You provide:** a short mono label (written like a file name, e.g. `your-ground · 84101`), the content, a tone (`paper`, `gold` or `green`) and, optionally, a step number.

**Anatomy**
- `border-2` in `line`, `--radius-window` (28), `--shadow-6`. Hero windows use `--radius-window-lg` or `--shadow-8`.
- Title bar 44px tall (`--size-titlebar`; 48 for hero windows), with a `border-2` rule underneath and the label in mono at `--type-mono`.
- Title bar colour by tone: `paper` window → `sand` bar; `gold` window → `paper` bar; `green` window → `green-deep` bar with `paper` text. A tool's main window may use a `green` bar.
- Optional number in a 24px circle before the label. Optional three window dots at the right, the last one filled `gold`.
- Body padding `--card-pad`, items `space-16` apart.

**Do**
- Keep one tool or one answer per window.
- Number windows when they show steps in order.
- Use at most one `gold` and one `green` window per section.

**Don't**
- Tilt a window.
- Put a window inside another window.
- Use a window for marketing copy alone. That is a Card.

Live example: `apps/web/app/components/landing/primitives.tsx` (`Window`).
