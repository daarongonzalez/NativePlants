import { useState } from "react";
import {
  PLOT_TILES,
  SAMPLE_PLANTS,
  emptyYard,
  formatDollars,
  formatNumber,
  isDarkSquare,
  plantedSqft,
  rebateFor,
  sageLine,
  tapTile,
  type Tile,
} from "../../lib/landing";
import { Flower, Stat, Window, Responsive } from "./primitives";

/**
 * "Try it": a 1,000 sq ft lawn of 40 squares. Pick a native seed, tap squares
 * to plant it, and watch the rebate add up.
 */
export function PlotPlanner() {
  const [seed, setSeed] = useState(0);
  const [yard, setYard] = useState<Tile[]>(emptyYard);

  const sqft = plantedSqft(yard);
  const selected = SAMPLE_PLANTS[seed]!;
  const reset = () => setYard(emptyYard());

  const resetButton = (where: "desktop" | "phone") => (
    <button
      type="button"
      className={`lp-button lp-button--paper lp-planner__reset lp-planner__reset--${where}`}
      onClick={reset}
    >
      Reset
    </button>
  );

  return (
    <Window
      label={<Responsive desktop="try-it · a 1,000 sq ft lawn" phone="try-it · 1,000 sq ft lawn" />}
      tone="paper"
      size="lg"
      dots
      className="lp-planner"
    >
      <div className="lp-sage">
        <div className="lp-sage__avatar" aria-hidden="true">
          Sage
        </div>
        <div className="lp-sage__bubble">
          <span className="lp-sage__name">Sage</span>
          <p aria-live="polite">{sageLine(yard)}</p>
        </div>
      </div>

      <div className="lp-planner__stats">
        <Stat label="Lawn swapped" value={`${formatNumber(sqft)} sq ft`} />
        <Stat label="Your rebate" value={formatDollars(rebateFor(sqft))} tone="gold" />
        {resetButton("desktop")}
      </div>

      <div className="lp-plot" role="group" aria-label={`Lawn plot, ${PLOT_TILES} squares`}>
        {yard.map((tile, i) => {
          const plant = tile === null ? null : SAMPLE_PLANTS[tile]!;
          const shade = [
            isDarkSquare(i, 10) ? "lp-tile--dark-d" : "",
            isDarkSquare(i, 5) ? "lp-tile--dark-m" : "",
          ].join(" ");
          return (
            <button
              key={i}
              type="button"
              className={`lp-tile ${plant ? "lp-tile--planted" : shade}`}
              aria-label={plant ? `${plant.common}, tap to remove` : "Lawn, tap to plant"}
              onClick={() => setYard((y) => tapTile(y, i, seed))}
            >
              {plant && <Flower token={plant.colorToken} />}
            </button>
          );
        })}
      </div>

      <div className="lp-planner__seeds">
        <div className="lp-seeds" role="radiogroup" aria-label="Choose a seed">
          {SAMPLE_PLANTS.map((p, i) => (
            <button
              key={p.common}
              type="button"
              role="radio"
              aria-checked={seed === i}
              aria-label={p.common}
              title={p.common}
              className={`lp-seed${seed === i ? " lp-seed--on" : ""}`}
              onClick={() => setSeed(i)}
            >
              <Flower token={p.colorToken} stem={false} />
              <span className="lp-seed__short">{p.short}</span>
            </button>
          ))}
        </div>
        <div className="lp-planner__chosen">
          <div className="lp-planner__name">
            <span className="lp-planner__planting lp-only-desktop">Planting</span>
            <span className="lp-planner__common">{selected.common}</span>
            <span className="np-sci-name lp-planner__sci">{selected.scientific}</span>
          </div>
          {resetButton("phone")}
        </div>
      </div>

      <p className="lp-footnote">
        Each square is 25 sq ft at $2.00 a sq ft · 200 sq ft minimum
        <span className="lp-only-desktop-inline"> · Utah Water Savers</span> · sample plants
      </p>
    </Window>
  );
}
