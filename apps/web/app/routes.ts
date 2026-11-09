import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  // The flow: address check, the report on your ground, then the plot planner.
  route("start", "routes/start.tsx"),
  route("report", "routes/report.tsx"),
  route("plan", "routes/plan.tsx"),
  // The saved plant list, kept in the browser.
  route("list", "routes/list.tsx"),
  // Content pages, written to be quoted by search and answer engines.
  route("about", "routes/about.tsx"),
  route("faq", "routes/faq.tsx"),
  route("rebates", "routes/rebates.tsx"),
  route("rebates/:slug", "routes/rebates.$slug.tsx"),
  route("blog", "routes/blog.tsx"),
  route("blog/:slug", "routes/blog.$slug.tsx"),
  route("privacy", "routes/privacy.tsx"),
  route("terms", "routes/terms.tsx"),
  // The plant review, for the reviewer only. Cloudflare Access guards /admin.
  route("admin/review", "routes/admin.review.tsx"),
  route("sitemap.xml", "routes/sitemap.ts"),
  route("robots.txt", "routes/robots.ts"),
  // Anything else is a 404, shown with the site's own error page.
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
