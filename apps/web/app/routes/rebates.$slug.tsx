import { Link, data } from "react-router";
import type { Route } from "./+types/rebates.$slug";
import { CHECK_LABELS, STAGE_TITLES, blackoutText, programBySlug, rateText, rulesByStage } from "../content/rebates";
import { Byline, PageHead, Sources } from "../components/site/Content";
import { PageShell } from "../components/site/SiteChrome";
import { Stat, Window } from "../components/landing/primitives";
import { formatDate } from "../lib/flow";
import { faqJsonLd, pageMeta } from "../lib/meta";

export function loader({ params }: Route.LoaderArgs) {
  const page = programBySlug(params.slug);
  if (!page) throw data(null, { status: 404 });
  return { slug: page.slug };
}

/** The questions people ask about a program, answered from its own rules. */
function programFaqs(slug: string) {
  const page = programBySlug(slug)!;
  const p = page.program;
  const blackout = blackoutText(p);
  return [
    { q: `How much does ${page.place}'s lawn rebate pay?`, a: `${rateText(p)}. ${p.amountNote ?? ""}`.trim() },
    { q: "What is the smallest project that qualifies?", a: `${p.minAreaSqft} sq ft. Several smaller areas can be added together.` },
    {
      q: "Do I need approval before I start?",
      a: p.requiresPreApproval
        ? "Yes. Do not start any work until after the site visit and approval. Work started earlier is not paid for."
        : "Check the program's page.",
    },
    {
      q: "How long do I have to finish?",
      a: `${p.completionMonths} months from the first site visit.${blackout ? ` Inspections usually stop from ${blackout} in cities with secondary irrigation water.` : ""}`,
    },
    { q: "Who gets paid?", a: `${p.payee ?? "The property owner"}.` },
  ];
}

export function meta({ loaderData }: Route.MetaArgs) {
  const page = programBySlug(loaderData?.slug);
  if (!page) return [{ title: "Not found · nativo" }];
  const p = page.program;
  return pageMeta({
    title: `${page.place} lawn rebate: the ${p.name}`,
    description: `${page.place}'s ${p.name} in plain language: ${rateText(p)}, a ${p.minAreaSqft} sq ft minimum, ${p.minPlantCoveragePct}% plant cover, and every rule in the program's own words.`,
    jsonLd: faqJsonLd(programFaqs(page.slug)),
  });
}

export default function RebateProgram({ loaderData }: Route.ComponentProps) {
  const page = programBySlug(loaderData.slug)!;
  const p = page.program;
  const faqs = programFaqs(page.slug);
  const blackout = blackoutText(p);

  return (
    <PageShell footerNote="Advice, not a guarantee. Only the rebate program can approve a project.">
      <PageHead
        badge={`Lawn rebates · ${page.place}`}
        title={
          <>
            {page.place}'s lawn rebate, <span className="lp-accent">in plain words</span>
          </>
        }
        lead={`The ${p.name}, run by ${p.utilityName}, pays property owners to replace living lawn with water-wise plants on drip. Here is every rule, in the program's words and ours.`}
      >
        <Byline updated={p.verifiedAt} draft={false} reviewed={false} />
      </PageHead>

      <div className="ct-stats">
        <Stat label="Pays up to" value={rateText(p)} source="rates vary by supplier" tone="gold" small />
        <Stat label="Smallest project" value={`${p.minAreaSqft} sq ft`} source="areas can be added" small />
        <Stat label="Plant cover" value={`${p.minPlantCoveragePct}%`} source="when fully grown" small />
        <Stat label="Time to finish" value={`${p.completionMonths} months`} source="from the first visit" small />
      </div>

      <section className="ct-layout" aria-labelledby="who-title">
        <div className="ct-prose">
          <h2 id="who-title">Who can apply</h2>
          <p>
            Property owners whose water supplier takes part in the program, with living lawn to replace. The payment goes
            to the {p.payee?.toLowerCase() ?? "property owner"} only. Rates and caps can differ by local water supplier, so
            confirm yours on the program's page before you plan your budget.
          </p>
          <h2>When to start</h2>
          <p>
            Apply while the lawn is still green and watered: the first site visit checks that it is alive. You then have{" "}
            {p.completionMonths} months to finish.
            {blackout
              ? ` In cities with secondary irrigation water, inspections usually stop from ${blackout}, so an approval late in the summer can leave a short window before winter.`
              : ""}
          </p>
          <h2>What Nativo checks for you</h2>
          <p>
            Our <Link to="/plan">plot planner</Link> checks the rules it can measure from your layout as you draw it. Rules
            only you or the inspector can settle are listed, never marked as passed.
          </p>
        </div>
        <aside className="ct-aside">
          <div className="lp-note lp-note--peach ct-note ct-note--left">
            <span className="lp-note__kicker">THE BIG ONE</span>
            <p>Do not start any work before the site visit and approval. Work started earlier is not paid for.</p>
          </div>
          <Link to="/plan" className="lp-button lp-button--green ct-button">
            Plan your yard
          </Link>
        </aside>
      </section>

      <section aria-labelledby="rules-title" className="ct-head">
        <h2 id="rules-title" className="lp-h2 lp-h2--green">
          Every rule, stage by stage
        </h2>
        <p className="lp-body-lg">Open any rule to read the program's own words.</p>
      </section>

      <div className="ct-stages">
        {rulesByStage(p).map(({ stage, rules }) => (
          <Window key={stage} label={STAGE_TITLES[stage].toLowerCase()} tone="paper">
            {rules.map((r) => (
              <div key={r.code} className="ct-rule">
                <span className="ct-rule__title">{r.title}</span>
                <p className="lp-body-sm">{r.plainText}</p>
                <span className={`lp-chip ct-rule__who ct-rule__who--${r.checkType}`}>{CHECK_LABELS[r.checkType]}</span>
                <details>
                  <summary>The program's words ({r.code})</summary>
                  <blockquote className="ct-rule__source">“{r.sourceText}”</blockquote>
                </details>
              </div>
            ))}
          </Window>
        ))}
      </div>

      <section aria-labelledby="faq-title" className="ct-faq">
        <h2 id="faq-title" className="lp-h3">
          Quick answers
        </h2>
        {faqs.map((f) => (
          <details key={f.q} className="ct-faq__item">
            <summary>{f.q}</summary>
            <div className="ct-faq__answer">
              <p>{f.a}</p>
            </div>
          </details>
        ))}
        <p className="lp-body-sm">
          More in the <Link to="/faq">FAQ</Link>.
        </p>
      </section>

      <Sources
        sources={[{ label: `${p.name} (rules version ${p.rulesVersion})`, url: p.sourceUrl, checked: p.verifiedAt }]}
      />
      <p className="fl-source">
        Rules copied from the program's published requirements on {formatDate(p.verifiedAt)}. If the program's page and
        this one disagree, the program's page is right.
      </p>
    </PageShell>
  );
}
