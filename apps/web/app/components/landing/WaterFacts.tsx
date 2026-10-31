import { Responsive } from "./primitives";

const SOURCE = "Utah Division of Water Resources";

const FACTS = [
  {
    figure: "60%",
    tone: "peach",
    desktop: "of home water in Utah is used outdoors.",
    phone: "of home water in Utah is used outdoors.",
  },
  {
    figure: "2×",
    tone: "sky",
    desktop: "Utah's population by 2065, on the same water.",
    phone: "population by 2065, on the same water.",
  },
  {
    figure: "3,000",
    tone: "meadow",
    desktop: "gallons saved by skipping one watering on a quarter-acre yard.",
    phone: "gallons saved skipping one watering on a quarter-acre.",
  },
] as const;

export function WaterFacts() {
  return (
    <section id="why-it-matters" className="lp-section lp-wrap lp-water" aria-labelledby="water-title">
      <div className="lp-water__head">
        <h2 id="water-title" className="lp-h2 lp-h2--green">
          Utah's water is stretched thin
        </h2>
        <p className="lp-body-lg">
          <Responsive
            desktop="Most of a Utah home's water goes on the yard, and most of that goes on grass that isn't built for a desert."
            phone="Most of a home's water goes on the yard, mostly on grass that isn't built for a desert."
          />
        </p>
      </div>
      <div className="lp-water__grid">
        {FACTS.map((f) => (
          <div key={f.figure} className={`lp-fact lp-note--${f.tone}`}>
            <span className="lp-fact__figure">{f.figure}</span>
            <span className="lp-body-lg">
              <Responsive desktop={f.desktop} phone={f.phone} />
            </span>
            <span className="lp-source lp-only-desktop">{SOURCE}</span>
          </div>
        ))}
      </div>
      <span className="lp-source lp-only-phone">{SOURCE}</span>
    </section>
  );
}
