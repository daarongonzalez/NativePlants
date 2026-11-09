import type { PolicyPage } from "../../content/types";
import { Byline, Contents, PageHead, Sections } from "./Content";
import { PageShell } from "./SiteChrome";

/** A policy page: heading, the date, a contents list and the sections. */
export function Policy({ page }: { page: PolicyPage }) {
  return (
    <PageShell>
      <PageHead badge="The small print, in plain words" title={page.title} lead={page.description}>
        <Byline updated={page.updated} draft={page.draft} reviewed={false} />
      </PageHead>
      <div className="ct-layout">
        <article className="ct-prose">
          {page.intro}
          <Sections sections={page.sections} />
        </article>
        <aside className="ct-aside">
          <Contents sections={page.sections} />
        </aside>
      </div>
    </PageShell>
  );
}
