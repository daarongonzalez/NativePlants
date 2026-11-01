Button is a chunky pill that presses into its shadow.

**You provide:** a short label and a tone: `green` (primary), `gold` (secondary, money, sign in) or `paper` (quiet actions such as Reset).

**Anatomy**
- Pill (`--radius-pill`), `border-2` in `line`, label in display type at `--type-button` or `--type-button-lg`.
- At least 44px tall. Small buttons carry `--shadow-2` or `--shadow-3`.
- Round buttons (− and +) are circles of `--size-round-button`.
- Pressed: `transform: var(--press)` and `--shadow-1`. A button set flush inside a pill form only sinks (`--press-down`).
- Focus: a `border-2` ink outline, offset 2px.

**Text on each tone**
- `green`: `paper`. `gold`: `ink`. `paper`: `ink`.

**Do**
- Use one `green` button per view for the main action.
- Write labels as plain actions: "Check my ground", "Sign in", "Reset".

**Don't**
- Put ink text on `green`.
- Use a shadow on a button sitting inside another bordered pill.

Live example: `.lp-button` in `apps/web/app/styles/landing.css`.
