import type { Route } from "./+types/robots";

/** Lets crawlers in, keeps them out of the per-address flow pages, and points at the sitemap. */
export function loader({ request }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const body = ["User-agent: *", "Disallow: /start", "Disallow: /report", "Disallow: /list", "Disallow: /admin", "", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
