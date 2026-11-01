import { useState } from "react";
import {
  LAWN_START,
  LAWN_STEP,
  clampLawn,
  formatDollars,
  formatNumber,
  rebateFor,
  rebateNote,
} from "../../lib/landing";
import { Responsive, Window } from "./primitives";

const PERKS = ["A smaller water bill", "No fertilizer or reseeding to buy", "No mower to run or fix"];

export function RebateCalculator() {
  const [lawn, setLawn] = useState(LAWN_START);
  const step = (by: number) => setLawn((l) => clampLawn(l + by));

  return (
    <section id="rebates" className="lp-section lp-wrap lp-money" aria-labelledby="money-title">
      <Window
        label={<Responsive desktop="rebate-calculator · your real lawn" phone="rebate-calculator" />}
        tone="gold"
        size="lg"
        className="lp-calc"
      >
        <h2 id="money-title" className="lp-h2-window">
          What's your lawn worth?
        </h2>
        <p className="lp-body-lg lp-only-desktop">Bigger than our little plot? Set your actual lawn size.</p>
        <div className="lp-calc__row">
          <div className="lp-calc__stepper">
            <button
              type="button"
              className="lp-button lp-button--paper lp-round"
              aria-label="Less lawn"
              onClick={() => step(-LAWN_STEP)}
            >
              −
            </button>
            <span className="lp-calc__size" aria-live="polite">
              {formatNumber(lawn)} sq ft
            </span>
            <button
              type="button"
              className="lp-button lp-button--paper lp-round"
              aria-label="More lawn"
              onClick={() => step(LAWN_STEP)}
            >
              +
            </button>
          </div>
          <span className="lp-calc__total" aria-live="polite">
            {formatDollars(rebateFor(lawn))}
          </span>
        </div>
        <span className="lp-calc__note">
          {rebateNote(lawn)}
          <span className="lp-only-desktop-inline"> · get approved before you dig</span> · Utah Water Savers
          <span className="lp-only-desktop-inline"> · checked Oct 2026</span>
        </span>
      </Window>

      <div className="lp-perks">
        <h3 className="lp-h3 lp-accent">Then, every summer</h3>
        <ul className="lp-perks__list">
          {PERKS.map((p, i) => (
            <li key={p} className="lp-perk">
              <span className="lp-perk__dot" aria-hidden="true" />
              {i === 1 ? <Responsive desktop={p} phone="No fertilizer or reseeding" /> : p}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
