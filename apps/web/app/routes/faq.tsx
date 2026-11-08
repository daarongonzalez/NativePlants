import { Link } from "react-router";
import type { Route } from "./+types/faq";
import leaf from "../../../../design/nativo/assets/Leaf/leaf-03-green.svg?url";
import { ALL_FAQS, FAQ_GROUPS } from "../content/faq";
import { UTAH } from "../content/rebates";
import { PageHead } from "../components/site/Content";
import { PageShell } from "../components/site/SiteChrome";
import { formatDate } from "../lib/flow";
import { faqJsonLd, pageMeta } from "../lib/meta";

export function meta(_: Route.MetaArgs) {
  return pageMeta({
    title: "Questions and answers",
    description:
      "Answers about Nativo, lawn rebates, native plants and your privacy. Rebate answers come straight from the program's rules, with Utah as the example.",
    jsonLd: faqJsonLd(ALL_FAQS),
  });
}

export default function FaqPage() {
  return (
    <PageShell>
      <PageHead
        badge="FAQ"
        title={
          <>
            Questions, <span className="lp-accent">answered</span>
          </>
        }
        lead="The rebate answers come from the same rules our plan check uses, so they always match."
      >
        <p className="ct-byline">
          Rebate rules last checked <time dateTime={UTAH.program.verifiedAt}>{formatDate(UTAH.program.verifiedAt)}</time>
        </p>
      </PageHead>

      <div className="ct-layout">
        <div className="ct-faq">
          {FAQ_GROUPS.map((g) => (
            <section key={g.id} className="ct-faq__group" aria-labelledby={`faq-${g.id}`}>
              <h2 id={`faq-${g.id}`} className="lp-h3 lp-accent">
                {g.title}
              </h2>
              {g.items.map((f) => (
                <details key={f.q} className="ct-faq__item">
                  <summary>{f.q}</summary>
                  <div className="ct-faq__answer">
                    <p>{f.a}</p>
                  </div>
                </details>
              ))}
            </section>
          ))}
        </div>
        <aside className="ct-aside">
          <div className="lp-note lp-note--sky ct-note ct-note--left">
            <span className="lp-note__kicker">STILL STUCK?</span>
            <p>
              Our guides go deeper. Start with <Link to="/blog/how-lawn-rebates-work">how lawn rebates work</Link>.
            </p>
          </div>
          <img src={leaf} alt="" className="ct-aside__art" />
        </aside>
      </div>
    </PageShell>
  );
}
