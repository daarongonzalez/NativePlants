import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportError, resetAlertMemory, safePath } from "@np/shared";
import app from "./index";

describe("reportError", () => {
  let posts: { url: string; body: { text: string; content: string } }[];
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    posts.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response("ok");
  }) as typeof fetch;

  beforeEach(() => {
    posts = [];
    resetAlertMemory();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("logs only without a webhook", () => {
    expect(reportError({}, "api", new Error("boom"), { fetchImpl })).toBeNull();
    expect(posts).toHaveLength(0);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("posts to the webhook without the query string, where addresses travel", async () => {
    await reportError({ ALERT_WEBHOOK_URL: "https://hooks.example/abc" }, "web loader", new Error("boom"), {
      fetchImpl,
      url: "https://grownativo.com/report?address=1373+S+Example+St&lat=40.7",
    });
    expect(posts).toHaveLength(1);
    expect(posts[0]!.body.text).toBe("nativo error in web loader (/report): Error: boom");
    expect(posts[0]!.body.content).toBe(posts[0]!.body.text);
    expect(JSON.stringify(posts)).not.toContain("Example");
  });

  it("alerts once per ten minutes for the same error, then again after", async () => {
    const env = { ALERT_WEBHOOK_URL: "https://hooks.example/abc" };
    await reportError(env, "api", new Error("same"), { fetchImpl, now: 0 });
    expect(reportError(env, "api", new Error("same"), { fetchImpl, now: 60_000 })).toBeNull();
    await reportError(env, "api", new Error("different"), { fetchImpl, now: 60_000 });
    await reportError(env, "api", new Error("same"), { fetchImpl, now: 11 * 60_000 });
    expect(posts.map((p) => p.body.text)).toEqual([
      "nativo error in api: Error: same",
      "nativo error in api: Error: different",
      "nativo error in api: Error: same",
    ]);
  });

  it("never throws when the webhook fails", async () => {
    const failing = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    await expect(reportError({ ALERT_WEBHOOK_URL: "https://hooks.example/x" }, "api", new Error("boom"), { fetchImpl: failing })).resolves.toBeUndefined();
  });

  it("strips query strings from paths", () => {
    expect(safePath("https://a.example/plan?address=secret")).toBe("/plan");
    expect(safePath("/report?lat=1")).toBe("/report");
    expect(safePath(undefined)).toBeNull();
  });
});

describe("the API's error handler", () => {
  it("answers a plain 500 and reports the error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // An invalid JSON body for a route that parses it would be a 400; force a real failure instead:
    // the visitor profile route with a database URL that cannot connect throws inside the handler.
    const res = await app.request(
      "/v1/public/rebates/ut-landscape-incentive",
      {},
      { HYPERDRIVE: { connectionString: "postgres://nobody@127.0.0.1:1/none" }, MARKET: "wasatch-front" },
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Something went wrong on our end." });
    expect(console.error).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
