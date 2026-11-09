import { Link } from "react-router";
import type { Route } from "./+types/rebates";
import grass from "../../../../design/nativo/assets/Grass/grass-03-green.svg?url";
import { PROGRAMS, rateText } from "../content/rebates";
import { PageHead } from "../components/site/Content";
import { PageShell } from "../components/site/SiteChrome";
import { Stat, Window } from "../components/landing/primitives";
import { formatDate } from "../lib/flow";
import { pageMeta } from "../lib/meta";

export function meta(_: Route.MetaArgs) {
  return pageMeta({
    title: "Lawn rebates",
    description:
      "Many water providers pay you to swap lawn for water-wise plants. How these rebates work, and the programs Nativo checks plans against.",
  });
}

const STEPS = [
  { title: "Apply", text: "Photos of the lawn now, a drawing of the new layout and a short description." },
  { title: "First site visit", text: "The program checks the lawn is alive and approves the plan. Do not start before this." },
  { title: "Do the work", text: "Remove the grass, lay drip, plant for grown size and mulch the ground." },
  { title: "Final inspection", text: "Plant cover, drip, filters and mulch are checked. You get time to fix anything that fails." },
  { title: "Get paid", text: "Sign the agreement and a tax form. The payment goes to the property owner." },
];

export default function Rebates() {
  return (
    <PageShell>
      <PageHead
        badge="Lawn rebates"
        title={
          <>
            Get paid to <span className="lp-accent">lose the lawn</span>
          </>
        }
        lead="In dry places, many water providers pay homeowners by the square foot to replace grass with water-wise plants. The rules differ by place, but the steps are nearly always the same."
      >
        <img src={grass} alt="" className="ct-head__art" />
      </PageHead>

      <section aria-labelledby="steps-title" className="ct-prose">
        <h2 id="steps-title">How it usually works</h2>
        <ol>
          {STEPS.map((s) => (
            <li key={s.title}>
              <strong>{s.title}.</strong> {s.text}
            </li>
          ))}
        </ol>
        <p>
          The full walk-through is in our guide, <Link to="/blog/how-lawn-rebates-work">How lawn rebates work, step by step</Link>.
        </p>
      </section>

      <section aria-labelledby="programs-title" className="ct-head">
        <h2 id="programs-title" className="lp-h2 lp-h2--green">
          Programs we check plans against
        </h2>
        <p className="lp-body-lg">
          We start where our soil and plant data is ready, and add programs as each new region opens.
        </p>
      </section>

      <div className="ct-cards">
        {PROGRAMS.map(({ slug, place, program }) => (
          <Window key={slug} label={`rebate · ${place.toLowerCase()}`} tone="gold" className="ct-program">
            <h3 className="lp-h3">{place}</h3>
            <p className="lp-body">
              {program.name}, run by {program.utilityName}.
            </p>
            <Stat
              label="Pays up to"
              value={rateText(program)}
              source={`checked ${formatDate(program.verifiedAt)}`}
              tone="gold"
              small
            />
            <Link to={`/rebates/${slug}`} className="lp-button lp-button--paper ct-button ct-self-start">
              Read the {place} rules
            </Link>
          </Window>
        ))}
        <aside className="lp-note lp-note--sky ct-note ct-note--right">
          <span className="lp-note__kicker">NOT IN UTAH?</span>
          <p>
            Search your water provider's website for “turf replacement”, “lawn conversion” or “landscape incentive”. The
            steps above will very likely apply.
          </p>
        </aside>
      </div>
    </PageShell>
  );
}
