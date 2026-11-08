import { AddressForm, type AddressState } from "./AddressForm";
import { PlotPlanner } from "./PlotPlanner";
import { Responsive } from "./primitives";

function Psst({ placement }: { placement: "side" | "top" }) {
  return (
    <aside className={`lp-note lp-note--peach lp-psst lp-psst--${placement}`}>
      <span className="lp-note__kicker">PSST</span>
      <span>
        In Utah, that's <b>$2 a sq ft</b>
        {placement === "side" ? " to swap lawn for water-wise plants. Try it on the plot →" : ". Try it below ↓"}
      </span>
    </aside>
  );
}

export function Hero({ address }: { address: AddressState }) {
  return (
    <section className="lp-hero lp-wrap" aria-labelledby="hero-title">
      <div className="lp-hero__copy">
        <span className="lp-badge lp-badge--sky lp-badge--tilt">Now serving the Wasatch Front</span>
        <h1 id="hero-title" className="lp-h1">
          Your lawn is <span className="lp-accent">thirsty.</span> Your town would like a word.
        </h1>
        <p className="lp-lead">
          <Responsive
            desktop="Nativo reads your soil and climate, works out what your water provider will pay you to swap the grass, and picks native plants that'll be happy in your yard. About two minutes."
            phone="Your soil and climate, what you could be paid to swap the grass, and native plants that'll be happy there. About two minutes."
          />
        </p>
        <AddressForm
          state={address}
          tone="green"
          placeholder="Where's your yard? e.g. 300 S State St"
        />
        <Psst placement="side" />
      </div>
      <div className="lp-hero__planner">
        <Psst placement="top" />
        <PlotPlanner />
      </div>
    </section>
  );
}
