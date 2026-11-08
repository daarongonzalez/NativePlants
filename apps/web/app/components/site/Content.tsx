import type { ReactNode } from "react";
import { formatDate } from "../../lib/flow";
import { AUTHOR, PLANT_REVIEWER } from "../../content/site";
import type { Section, Source } from "../../content/types";
import { Window } from "../landing/primitives";

/** The heading block at the top of a content page. */
export function PageHead({
  badge,
  title,
  lead,
  children,
  as = "h1",
}: {
  badge?: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  as?: "h1";
}) {
  const H = as;
  return (
    <section className="ct-head" aria-labelledby="page-title">
      {badge && <span className="lp-badge lp-badge--sky">{badge}</span>}
      <H id="page-title" className="lp-h2">
        {title}
      </H>
      {lead && <p className="lp-lead">{lead}</p>}
      {children}
    </section>
  );
}

/** Shown on anything not yet reviewed. Dashed, like the other "not final" marks in the system. */
export function DraftBadge() {
  return <span className="ct-draft">Draft · awaiting review</span>;
}

/** A gap someone needs to fill before launch, highlighted so it cannot be missed. */
export function Placeholder({ children }: { children: ReactNode }) {
  return <mark className="ct-placeholder">{children}</mark>;
}

/** A site fact from content/site.ts: the value once it is set, a highlighted gap until then. */
export function Fact({ value, missing }: { value: string | null; missing: string }) {
  return value ? <>{value}</> : <Placeholder>[{missing}]</Placeholder>;
}

/** Who wrote it, who checked it, and when. */
export function Byline({
  updated,
  published,
  draft,
  readingMinutes,
  reviewed = true,
}: {
  updated: string;
  published?: string;
  draft: boolean;
  readingMinutes?: number;
  /** Whether the plant reviewer signs this page. Policy pages are not plant advice. */
  reviewed?: boolean;
}) {
  return (
    <p className="ct-byline">
      {draft && <DraftBadge />}
      <span>By {AUTHOR.name}</span>
      {reviewed && (
        <>
          <span className="ct-byline__sep" aria-hidden="true">
            ·
          </span>
          <span>
            Plant facts reviewed by{" "}
            {PLANT_REVIEWER ? PLANT_REVIEWER.name : <Placeholder>reviewer to confirm</Placeholder>}
          </span>
        </>
      )}
      <span className="ct-byline__sep" aria-hidden="true">
        ·
      </span>
      <span>
        {published && published !== updated ? `Published ${formatDate(published)} · ` : ""}
        Last checked <time dateTime={updated}>{formatDate(updated)}</time>
      </span>
      {readingMinutes && (
        <>
          <span className="ct-byline__sep" aria-hidden="true">
            ·
          </span>
          <span>{readingMinutes} min read</span>
        </>
      )}
    </p>
  );
}

/** The short answer at the top of a guide, in a window answer engines can lift whole. */
export function ShortAnswer({ points }: { points: string[] }) {
  return (
    <Window label="the-short-answer" tone="paper" className="ct-answer">
      <ul>
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </Window>
  );
}

/** Sections rendered as prose, each heading an anchor. */
export function Sections({ sections }: { sections: Section[] }) {
  return (
    <div className="ct-prose">
      {sections.map((s) => (
        <section key={s.id} aria-labelledby={s.id} className="ct-prose">
          <h2 id={s.id}>{s.heading}</h2>
          {s.body}
        </section>
      ))}
    </div>
  );
}

/** "On this page": a contents list for the aside. */
export function Contents({ sections }: { sections: Section[] }) {
  return (
    <nav aria-label="On this page" className="lp-note lp-note--meadow ct-note ct-note--left">
      <span className="lp-note__kicker">ON THIS PAGE</span>
      <ul className="ct-toc">
        {sections.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`}>{s.heading}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Where every fact on the page came from, with the date we last read it. */
export function Sources({ sources }: { sources: Source[] }) {
  return (
    <section className="ct-sources" aria-labelledby="sources-title">
      <h2 id="sources-title" className="lp-h3">
        Sources
      </h2>
      <ol>
        {sources.map((s) => (
          <li key={s.url + s.label}>
            <a href={s.url} rel="noopener noreferrer">
              {s.label}
            </a>{" "}
            · checked {formatDate(s.checked)}
          </li>
        ))}
      </ol>
    </section>
  );
}
