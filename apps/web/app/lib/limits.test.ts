import { describe, expect, it, vi } from "vitest";
import type { AppLoadContext } from "react-router";
import { enforceLimit, type RateLimiter } from "./limits.server";

/** A limiter that allows `allow` calls per key, like Cloudflare's. */
function limiter(allow: number): RateLimiter & { keys: string[] } {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  return {
    keys,
    async limit({ key }) {
      keys.push(key);
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return { success: n <= allow };
    },
  };
}

const context = (env: Record<string, unknown>) => ({ cloudflare: { env, ctx: {} } }) as unknown as AppLoadContext;
const visit = (ip: string) => new Request("https://grownativo.com/start?address=x", { headers: { "CF-Connecting-IP": ip } });

describe("enforceLimit", () => {
  it("lets a visitor through up to the limit, then answers 429", async () => {
    const lookup = limiter(2);
    const ctx = context({ LOOKUP_LIMIT: lookup });
    await enforceLimit(ctx, visit("203.0.113.5"), "lookup");
    await enforceLimit(ctx, visit("203.0.113.5"), "lookup");
    const third = await enforceLimit(ctx, visit("203.0.113.5"), "lookup").catch((e: unknown) => e);
    expect(third).toMatchObject({ init: { status: 429 } });
    // Another visitor is unaffected.
    await expect(enforceLimit(ctx, visit("198.51.100.9"), "lookup")).resolves.toBeUndefined();
    expect(lookup.keys[0]).toBe("lookup:203.0.113.5");
  });

  it("keeps each kind of request separate", async () => {
    const ctx = context({ LOOKUP_LIMIT: limiter(0), CHECK_LIMIT: limiter(5) });
    await expect(enforceLimit(ctx, visit("203.0.113.5"), "check")).resolves.toBeUndefined();
    await expect(enforceLimit(ctx, visit("203.0.113.5"), "lookup")).rejects.toMatchObject({ init: { status: 429 } });
  });

  it("does nothing without a limiter, and lets requests through if the limiter breaks", async () => {
    await expect(enforceLimit(context({}), visit("1.2.3.4"), "estimate")).resolves.toBeUndefined();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const broken: RateLimiter = { limit: async () => Promise.reject(new Error("down")) };
    await expect(enforceLimit(context({ ESTIMATE_LIMIT: broken }), visit("1.2.3.4"), "estimate")).resolves.toBeUndefined();
    vi.restoreAllMocks();
  });
});
