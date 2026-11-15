import { createRequestHandler } from "react-router";
import { reportError } from "@np/shared";
import type { RateLimiter } from "../app/lib/limits.server";

/**
 * What the web Worker is bound to. The API is reached through a service
 * binding (no public hop, no CORS). API_URL is the fallback for local
 * development, set in .dev.vars, when the API Worker is not bound.
 */
export interface WebEnv {
  API?: Fetcher;
  API_URL?: string;
  /** Per-visitor rate limits (wrangler.toml). Absent in local development. */
  LOOKUP_LIMIT?: RateLimiter;
  ESTIMATE_LIMIT?: RateLimiter;
  CHECK_LIMIT?: RateLimiter;
  /** A Slack or Discord incoming webhook for error alerts. A Worker secret; optional. */
  ALERT_WEBHOOK_URL?: string;
}

declare module "react-router" {
  interface AppLoadContext {
    cloudflare: { env: WebEnv; ctx: ExecutionContext };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    try {
      return await requestHandler(request, { cloudflare: { env, ctx } });
    } catch (error) {
      // Anything that escapes React Router's own error pages.
      reportError(env, "web", error, { url: request.url, ctx });
      return new Response("Something went wrong on our end. Please try again in a moment.", {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  },
} satisfies ExportedHandler<WebEnv>;
