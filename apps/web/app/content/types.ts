import type { ReactNode } from "react";

/** A source a page rests on. `checked` is when we last read it, as YYYY-MM-DD. */
export interface Source {
  label: string;
  url: string;
  checked: string;
}

/** A question and a plain-text answer. Plain text, so it can go into FAQ markup for search and answer engines. */
export interface Faq {
  q: string;
  a: string;
}

/** A section of a guide. The heading becomes an anchor in the contents list. */
export interface Section {
  id: string;
  heading: string;
  body: ReactNode;
}

/**
 * A guide (a blog post). Written as a file in the repository and rendered by
 * the web app. Each one is signed, dated and sourced.
 *
 * `draft: true` shows a "Draft" badge and asks search engines not to list the
 * page. Flip it to false once the post has been reviewed.
 */
export interface Post {
  slug: string;
  title: string;
  /** One sentence for search results and link previews. */
  description: string;
  /** The tag on the card, e.g. "Rebates". */
  tag: string;
  published: string;
  updated: string;
  draft: boolean;
  readingMinutes: number;
  /** Three or four bullets at the top: the short answer an answer engine should quote. */
  shortAnswer: string[];
  sections: Section[];
  faqs: Faq[];
  sources: Source[];
}

/** A plain policy page: privacy or terms. */
export interface PolicyPage {
  title: string;
  description: string;
  updated: string;
  draft: boolean;
  intro: ReactNode;
  sections: Section[];
}
