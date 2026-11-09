import { Link } from "react-router";
import type { Route } from "./+types/blog";
import branch from "../../../../design/nativo/assets/Branch/branch-04-green.svg?url";
import { POSTS } from "../content/posts";
import { DraftBadge, PageHead } from "../components/site/Content";
import { PageShell } from "../components/site/SiteChrome";
import { formatDate } from "../lib/flow";
import { pageMeta } from "../lib/meta";

export function meta(_: Route.MetaArgs) {
  return pageMeta({
    title: "Guides",
    description:
      "Plain-language guides to lawn rebates, native plants and water-wise yards. Signed, dated and sourced, with Utah as the worked example.",
  });
}

export default function Blog() {
  return (
    <PageShell>
      <PageHead
        badge="Guides"
        title={
          <>
            Know the rules <span className="lp-accent">before you dig</span>
          </>
        }
        lead="Short, sourced guides to lawn rebates and native planting. Each one is signed, dated and checked against the program's own words. We use Utah as the worked example."
      >
        <img src={branch} alt="" className="ct-head__art" />
      </PageHead>

      <ul className="ct-cards" aria-label="Guides" role="list">
        {POSTS.map((p) => (
          <li key={p.slug}>
            <Link to={`/blog/${p.slug}`} className="ct-card-link">
              <article className="lp-card">
                <span className="lp-badge lp-badge--meadow">{p.tag}</span>
                <h2 className="lp-h3-card">{p.title}</h2>
                <p className="lp-body-sm">{p.description}</p>
                <span className="ct-card__meta">
                  {p.draft ? <DraftBadge /> : null} {formatDate(p.updated)} · {p.readingMinutes} min read
                </span>
              </article>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
