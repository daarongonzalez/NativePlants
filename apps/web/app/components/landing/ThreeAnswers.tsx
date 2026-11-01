import leaf from "../../../../../design/nativo/assets/Leaf/leaf-02-green.svg?url";
import { SAMPLE_PLANTS } from "../../lib/landing";
import { Responsive, Stat, Window } from "./primitives";

export function ThreeAnswers() {
  return (
    <section className="lp-band lp-band--meadow" aria-labelledby="answers-title">
      <div className="lp-wrap lp-answers">
        <div className="lp-answers__head">
          <h2 id="answers-title" className="lp-h2 lp-h2--deep">
            One address, three answers
          </h2>
          <img src={leaf} alt="" className="lp-answers__leaf lp-only-desktop" />
        </div>
        <div className="lp-answers__grid">
          <Window label="your-ground · 84101" number={1} className="lp-answer lp-answer--ground">
            <h3 className="lp-h3">What's under your feet</h3>
            <p className="lp-body lp-only-desktop">
              Soil, zone, frost and sun, from county surveys and weather records.
            </p>
            <div className="lp-stat-grid">
              <Stat label="Zone" value="7b" source="USDA" />
              <Stat label="Soil pH" value="7.8" source="Soil survey" />
              <Stat label="Frost-free" value={<Responsive desktop="187 days" phone="187 d" />} source="NOAA" />
              <Stat label="Last frost" value="31 Mar–9 May" source="NOAA" small />
            </div>
          </Window>

          <Window label="your-rebate" number={2} tone="gold" className="lp-answer lp-answer--rebate">
            <div className="lp-answer__rebate-body">
              <div className="lp-answer__rebate-text">
                <h3 className="lp-h3">A rebate for your lawn</h3>
                <p className="lp-body">
                  <Responsive
                    desktop="Your rate, the rules and the steps, for your water provider."
                    phone="Your rate, rules and steps."
                  />
                </p>
              </div>
              <span className="lp-price">
                $2<span className="lp-price__unit"> / sq ft</span>
              </span>
            </div>
          </Window>

          <Window label="your-plants · sample" number={3} tone="green" className="lp-answer lp-answer--plants">
            <h3 className="lp-h3">Plants that'll be happy there</h3>
            <p className="lp-body lp-only-desktop">
              Ranked for your soil and sun, with a list to take to the nursery.
            </p>
            <ul className="lp-chips">
              {SAMPLE_PLANTS.map((p) => (
                <li key={p.common} className="lp-chip">
                  {p.common}
                </li>
              ))}
            </ul>
          </Window>
        </div>
      </div>
    </section>
  );
}
