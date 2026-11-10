import type { MetaDescriptor } from "react-router";

/**
 * The live site's address. Link previews (iMessage, Slack, LinkedIn) only load
 * an image from a full web address, so the share image needs it spelled out.
 */
export const SITE_ORIGIN = "https://grownativo.com";

/**
 * The share card shown when a link to any page is pasted into a chat or post.
 * Drawn from `apps/web/og/card.html`; re-draw it with `pnpm --filter @np/web og`.
 */
export const shareImageMeta: MetaDescriptor[] = [
  { property: "og:type", content: "website" },
  { property: "og:image", content: `${SITE_ORIGIN}/og.png` },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "630" },
  { property: "og:image:alt", content: "nativo: native plants and lawn rebates for your yard" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:image", content: `${SITE_ORIGIN}/og.png` },
];

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
    ...shareImageMeta,
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
