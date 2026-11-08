import type { Route } from "./+types/sitemap";
import { POSTS } from "../content/posts";
import { PROGRAMS } from "../content/rebates";
import { PRIVACY } from "../content/privacy";
import { TERMS } from "../content/terms";

/**
 * The public pages, for search and answer engines. Drafts are left out until
 * they are reviewed, the same pages that carry `noindex`. The About page joins
 * when its draft flag is turned off there.
 */
export function loader({ request }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const pages: { path: string; updated?: string }[] = [
    { path: "/" },
    { path: "/plan" },
    { path: "/rebates" },
    ...PROGRAMS.map((p) => ({ path: `/rebates/${p.slug}`, updated: p.program.verifiedAt })),
    { path: "/faq" },
    { path: "/blog" },
    ...POSTS.filter((p) => !p.draft).map((p) => ({ path: `/blog/${p.slug}`, updated: p.updated })),
    ...(PRIVACY.draft ? [] : [{ path: "/privacy", updated: PRIVACY.updated }]),
    ...(TERMS.draft ? [] : [{ path: "/terms", updated: TERMS.updated }]),
  ];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...pages.map(
      (p) => `  <url><loc>${origin}${p.path}</loc>${p.updated ? `<lastmod>${p.updated}</lastmod>` : ""}</url>`,
    ),
    "</urlset>",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
