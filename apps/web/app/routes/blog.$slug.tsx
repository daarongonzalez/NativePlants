import { Link, data } from "react-router";
import type { Route } from "./+types/blog.$slug";
import leaf from "../../../../design/nativo/assets/Leaf/leaf-05-green.svg?url";
import { AUTHOR, PLANT_REVIEWER } from "../content/site";
import { postBySlug } from "../content/posts";
import { Byline, Contents, PageHead, Sections, ShortAnswer, Sources } from "../components/site/Content";
import { PageShell } from "../components/site/SiteChrome";
import { faqJsonLd, pageMeta } from "../lib/meta";

export function loader({ params }: Route.LoaderArgs) {
  const post = postBySlug(params.slug);
  if (!post) throw data(null, { status: 404 });
  return { slug: post.slug };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const post = postBySlug(loaderData?.slug);
  if (!post) return [{ title: "Not found · nativo" }];
  return pageMeta({
    title: post.title,
    description: post.description,
    draft: post.draft,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Article",
          headline: post.title,
          description: post.description,
          datePublished: post.published,
          dateModified: post.updated,
          author: { "@type": "Organization", name: AUTHOR.name },
          ...(PLANT_REVIEWER ? { reviewedBy: { "@type": "Person", name: PLANT_REVIEWER.name } } : {}),
          citation: post.sources.map((s) => s.url),
        },
        faqJsonLd(post.faqs),
      ],
    },
  });
}

export default function BlogPost({ loaderData }: Route.ComponentProps) {
  // Content lives in code, so the loader passes only the slug and the page reads the post itself.
  const post = postBySlug(loaderData.slug)!;
  return (
    <PageShell>
      <PageHead badge={post.tag} title={post.title} lead={post.description}>
        <Byline
          updated={post.updated}
          published={post.published}
          draft={post.draft}
          readingMinutes={post.readingMinutes}
        />
      </PageHead>

      <div className="ct-layout">
        <article className="ct-prose">
          <ShortAnswer points={post.shortAnswer} />
          <Sections sections={post.sections} />
          {post.faqs.length > 0 && (
            <section aria-labelledby="questions" className="ct-faq">
              <h2 id="questions">Common questions</h2>
              {post.faqs.map((f) => (
                <details key={f.q} className="ct-faq__item">
                  <summary>{f.q}</summary>
                  <div className="ct-faq__answer">
                    <p>{f.a}</p>
                  </div>
                </details>
              ))}
            </section>
          )}
          <Sources sources={post.sources} />
        </article>

        <aside className="ct-aside">
          <Contents sections={post.sections} />
          <div className="lp-note lp-note--peach ct-note ct-note--right">
            <span className="lp-note__kicker">TRY IT ON YOUR YARD</span>
            <p>Lay out your lawn square by square, and see which rules it meets as you go.</p>
            <Link to="/plan" className="lp-button lp-button--green ct-button">
              Open the planner
            </Link>
          </div>
          <img src={leaf} alt="" className="ct-aside__art" />
        </aside>
      </div>
    </PageShell>
  );
}
