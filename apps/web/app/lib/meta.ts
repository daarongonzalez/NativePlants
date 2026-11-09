import type { MetaDescriptor } from "react-router";

/**
 * Title, description and structured data for a content page.
 *
 * Drafts carry `noindex`, so search and answer engines leave them alone until
 * they are reviewed. Structured data uses relative links, so it is right on
 * whatever domain the site launches on.
 */
export function pageMeta({
  title,
  description,
  draft = false,
  jsonLd,
}: {
  title: string;
  description: string;
  draft?: boolean;
  jsonLd?: Record<string, unknown>;
}): MetaDescriptor[] {
  const tags: MetaDescriptor[] = [
    { title: `${title} · nativo` },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:site_name", content: "Nativo" },
  ];
  if (draft) tags.push({ name: "robots", content: "noindex" });
  if (jsonLd) tags.push({ "script:ld+json": jsonLd });
  return tags;
}

/** FAQ markup for a list of questions with plain-text answers. */
export function faqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
