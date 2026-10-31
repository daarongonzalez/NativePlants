import tree from "../../../../../design/nativo/assets/Tree/tree-02-green.svg?url";
import { Responsive } from "./primitives";

const BENEFITS = [
  {
    tag: "Water",
    tone: "sky",
    title: "Far less of it",
    desktop: "Once settled in, many need only an occasional deep drink on drip.",
    phone: "Many need only an occasional deep drink on drip.",
  },
  {
    tag: "Weekends",
    tone: "gold",
    title: "Less work",
    desktop: "No mowing, no fertilizer, no reseeding. A tidy-up in spring.",
    phone: "No mowing or fertilizer. A tidy-up in spring.",
  },
  {
    tag: "Visitors",
    tone: "meadow",
    title: "Bees and birds return",
    desktop: "They evolved with these plants. A lawn feeds almost none of them.",
    phone: "A lawn feeds almost none of them.",
  },
] as const;

export function NativeYard() {
  return (
    <section id="native-yards" className="lp-band lp-band--sand" aria-labelledby="native-title">
      <div className="lp-wrap lp-native">
        <div className="lp-native__intro">
          <h2 id="native-title" className="lp-h2 lp-h2--green">
            Why a native yard
          </h2>
          <p className="lp-body-lg lp-only-desktop">
            They grew up here. Alkaline soil and dry summers don't bother them one bit.
          </p>
          <img src={tree} alt="" className="lp-native__tree lp-only-desktop" />
        </div>
        <div className="lp-native__grid">
          {BENEFITS.map((b) => (
            <article key={b.tag} className="lp-card">
              <span className={`lp-badge lp-badge--${b.tone}`}>{b.tag}</span>
              <h3 className="lp-h3-card">{b.title}</h3>
              <p className="lp-body-sm">
                <Responsive desktop={b.desktop} phone={b.phone} />
              </p>
            </article>
          ))}
          {/* Confirm the HOA law wording before launch. */}
          <aside className="lp-card lp-note--peach lp-card--note">
            <span className="lp-note__kicker">GOOD TO KNOW</span>
            <h3 className="lp-h3-card">Your HOA can't say no</h3>
            <p className="lp-body-sm">
              <Responsive
                desktop="Since 2023, Utah HOAs can require no more than half a yard to be non-water-wise."
                phone="Since 2023, HOAs can require no more than half a yard be non-water-wise."
              />
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
