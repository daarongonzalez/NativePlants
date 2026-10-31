/**
 * Data and rules behind the landing page. Kept free of React so the numbers
 * can be tested on their own.
 */

/** Utah Water Savers rate, checked October 2026. Local district rates win when known. */
export const REBATE_PER_SQFT = 2;
export const REBATE_MIN_SQFT = 200;

/** The plot planner: 40 squares of 25 sq ft each, a 1,000 sq ft lawn. */
export const PLOT_TILES = 40;
export const SQFT_PER_TILE = 25;

/** The calculator's lawn size: starts at 500, steps of 100, 100 to 5,000. */
export const LAWN_START = 500;
export const LAWN_STEP = 100;
export const LAWN_MIN = 100;
export const LAWN_MAX = 5000;

export type SamplePlant = {
  common: string;
  scientific: string;
  short: string;
  /** CSS custom property holding the seed colour. */
  colorToken: string;
};

/** Sample plants only. The recommendation engine's output replaces these. */
export const SAMPLE_PLANTS: readonly SamplePlant[] = [
  { common: "Firecracker penstemon", scientific: "Penstemon eatonii", short: "Penst.", colorToken: "--seed-penstemon" },
  { common: "Desert globemallow", scientific: "Sphaeralcea ambigua", short: "Mallow", colorToken: "--seed-globemallow" },
  { common: "Sulphur-flower buckwheat", scientific: "Eriogonum umbellatum", short: "Buckw.", colorToken: "--seed-buckwheat" },
  { common: "Blue flax", scientific: "Linum lewisii", short: "Flax", colorToken: "--seed-flax" },
];

/** One square of the plot: empty lawn, or the index of the seed planted there. */
export type Tile = number | null;

export const emptyYard = (): Tile[] => Array<Tile>(PLOT_TILES).fill(null);

/**
 * Tap a square with a seed selected. Same seed: back to lawn. Lawn or a
 * different seed: plant the selected one.
 */
export function tapTile(yard: readonly Tile[], index: number, seed: number): Tile[] {
  const next = yard.slice();
  next[index] = yard[index] === seed ? null : seed;
  return next;
}

export const formatNumber = (n: number) => n.toLocaleString("en-US");
export const formatDollars = (n: number) => "$" + formatNumber(n);

export const rebateFor = (sqft: number) => sqft * REBATE_PER_SQFT;

export function plantedSqft(yard: readonly Tile[]): number {
  return yard.filter((t) => t !== null).length * SQFT_PER_TILE;
}

/** What Sage says, given how much of the plot is planted. */
export function sageLine(yard: readonly Tile[]): string {
  const sqft = plantedSqft(yard);
  if (sqft === 0) return "Pick a seed below, then tap a patch of grass. Go on, it doesn't bite!";
  if (sqft === PLOT_TILES * SQFT_PER_TILE) return "A whole native yard! The bees are writing you a thank-you note.";
  if (sqft < REBATE_MIN_SQFT) return `Nice! Just ${REBATE_MIN_SQFT - sqft} more sq ft and the rebate kicks in.`;
  return `That's ${formatDollars(rebateFor(sqft))} from Utah. Ready to try your real yard? Pop your address in.`;
}

export const clampLawn = (sqft: number) => Math.min(LAWN_MAX, Math.max(LAWN_MIN, sqft));

export const rebateNote = (sqft: number) =>
  sqft >= REBATE_MIN_SQFT ? "Meets the 200 sq ft minimum" : "Under the 200 sq ft minimum";

/**
 * Checkerboard shade for a square, given how many columns the grid shows.
 * The plot is 10 columns on desktop and 5 on phone.
 */
export const isDarkSquare = (index: number, columns: number) =>
  (Math.floor(index / columns) + (index % columns)) % 2 === 1;
