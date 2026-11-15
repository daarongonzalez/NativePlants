import { data, type AppLoadContext } from "react-router";

/**
 * Per-visitor rate limits for the pages that call outside services (the
 * address lookup, the soil and yard estimate) or write to the database (the
 * plan check). Limits are set in wrangler.toml.
 *
 * Over the limit, the loader throws a 429 that the site's own error page
 * explains; the expensive call is never made. Without the binding (local
 * development, tests), nothing is limited.
 */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export type Bucket = "lookup" | "estimate" | "check";

const BINDING: Record<Bucket, "LOOKUP_LIMIT" | "ESTIMATE_LIMIT" | "CHECK_LIMIT"> = {
  lookup: "LOOKUP_LIMIT",
  estimate: "ESTIMATE_LIMIT",
  check: "CHECK_LIMIT",
};

/** Cloudflare sets this on every request from the internet, and it cannot be faked by the visitor. */
export const visitorKey = (request: Request) => request.headers.get("CF-Connecting-IP") ?? "unknown";

export async function enforceLimit(context: AppLoadContext, request: Request, bucket: Bucket): Promise<void> {
  const limiter = context.cloudflare.env[BINDING[bucket]];
  if (!limiter) return;
  let ok = true;
  try {
    ok = (await limiter.limit({ key: `${bucket}:${visitorKey(request)}` })).success;
  } catch (error) {
    // A broken limiter must not take the site down: let the request through.
    console.error(JSON.stringify({ level: "error", where: "rate limit", message: String(error).slice(0, 200) }));
  }
  if (!ok) throw data({ bucket }, { status: 429, headers: { "Retry-After": "60" } });
}
