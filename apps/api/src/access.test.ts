import { beforeAll, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { ACCESS_HEADER, requireReviewer, reviewerList, verifyAccessToken, type CertFetcher } from "./access";
import { adminRoutes } from "./admin";
import app from "./index";
import type { Env } from "./env";

/**
 * Real RS256 tokens, signed with a key made for the test, so the checks run
 * exactly as they will against Cloudflare's own keys.
 */
const TEAM = "nativo-test.cloudflareaccess.com";
const AUD = "test-aud-tag";
const REVIEWER = "rachel@example.com";

let goodKey: CryptoKeyPair;
let otherKey: CryptoKeyPair;
let certs: CertFetcher;

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

async function sign(claims: Record<string, unknown>, key: CryptoKeyPair = goodKey, kid = "k1", alg = "RS256") {
  const head = enc({ alg, kid, typ: "JWT" });
  const body = enc(claims);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key.privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}

const nowSec = () => Math.floor(Date.now() / 1000);
const claims = (over: Record<string, unknown> = {}) => ({
  email: REVIEWER,
  aud: [AUD],
  iss: `https://${TEAM}`,
  exp: nowSec() + 600,
  ...over,
});

beforeAll(async () => {
  const gen = () =>
    crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"],
    ) as Promise<CryptoKeyPair>;
  goodKey = await gen();
  otherKey = await gen();
  const jwk = { ...((await crypto.subtle.exportKey("jwk", goodKey.publicKey)) as JsonWebKey), kid: "k1" };
  certs = async () => [jwk];
});

describe("verifyAccessToken", () => {
  const config = { teamDomain: TEAM, aud: AUD };

  it("accepts a token signed by the team, for this app, in date", async () => {
    const result = await verifyAccessToken(await sign(claims()), config, certs);
    expect(result).toMatchObject({ ok: true, claims: { email: REVIEWER } });
  });

  it.each([
    ["signed with another key", () => sign(claims(), otherKey), "bad signature"],
    ["from an unknown key id", () => sign(claims(), goodKey, "k9"), "unknown key"],
    ["for another app", () => sign(claims({ aud: ["someone-else"] })), "wrong audience"],
    ["from another team", () => sign(claims({ iss: "https://evil.cloudflareaccess.com" })), "wrong issuer"],
    ["expired", () => sign(claims({ exp: nowSec() - 5 })), "expired"],
    ["without an email", () => sign(claims({ email: "" })), "no email"],
    ["using another algorithm", () => sign(claims(), goodKey, "k1", "HS256"), "wrong algorithm"],
  ])("refuses a token %s", async (_label, make, reason) => {
    expect(await verifyAccessToken(await make(), config, certs)).toEqual({ ok: false, reason });
  });

  it("refuses a token whose claims were edited after signing", async () => {
    const [h, , s] = (await sign(claims({ email: "someone@example.com" }))).split(".");
    const forged = `${h}.${enc(claims())}.${s}`;
    expect(await verifyAccessToken(forged, config, certs)).toEqual({ ok: false, reason: "bad signature" });
  });

  it("refuses rubbish", async () => {
    expect(await verifyAccessToken("not-a-token", config, certs)).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("requireReviewer", () => {
  const env = (over: Partial<Env> = {}) =>
    ({
      HYPERDRIVE: { connectionString: "postgres://unused" },
      MARKET: "wasatch-front",
      ACCESS_TEAM_DOMAIN: TEAM,
      ACCESS_AUD: AUD,
      REVIEWER_EMAILS: ` ${REVIEWER.toUpperCase()} , other@example.com`,
      ...over,
    }) as Env;

  const probe = () => {
    const h = new Hono<{ Bindings: Env; Variables: { reviewer: string } }>();
    h.use("*", requireReviewer(certs));
    h.get("/whoami", (c) => c.json({ reviewer: c.get("reviewer") }));
    return h;
  };
  const call = async (token: string | null, e = env()) =>
    probe().request("/whoami", { headers: token ? { [ACCESS_HEADER]: token } : {} }, e);

  it("lets a listed reviewer through, matching email case-insensitively", async () => {
    const res = await call(await sign(claims()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reviewer: REVIEWER });
  });

  it("asks for a sign-in when there is no token", async () => {
    expect((await call(null)).status).toBe(401);
  });

  it("turns away a valid sign-in that is not on the reviewer list", async () => {
    expect((await call(await sign(claims({ email: "visitor@example.com" })))).status).toBe(403);
  });

  it("turns away an invalid token", async () => {
    expect((await call(await sign(claims(), otherKey))).status).toBe(401);
  });

  it("stays closed when it is not set up", async () => {
    const token = await sign(claims());
    expect((await call(token, env({ ACCESS_AUD: "" }))).status).toBe(503);
    expect((await call(token, env({ ACCESS_TEAM_DOMAIN: undefined } as unknown as Partial<Env>))).status).toBe(503);
    expect((await call(token, env({ REVIEWER_EMAILS: " , " }))).status).toBe(503);
  });
});

describe("review routes", () => {
  const env = {
    HYPERDRIVE: { connectionString: "postgres://unused" },
    MARKET: "wasatch-front",
    ACCESS_TEAM_DOMAIN: TEAM,
    ACCESS_AUD: AUD,
    REVIEWER_EMAILS: REVIEWER,
  };

  it("are closed to visitors in the deployed app", async () => {
    // The real app, with no Access settings at all: closed, not open.
    const res = await app.request("/v1/admin/plants", {}, { HYPERDRIVE: { connectionString: "postgres://unused" }, MARKET: "wasatch-front" });
    expect(res.status).toBe(503);
  });

  it("turn away a fail with no reason before touching the database", async () => {
    const routes = adminRoutes(certs);
    const res = await routes.request(
      "/plants/7b0c6f8e-2a4e-4f55-9c1d-3c2f1d0e9a11/review",
      {
        method: "POST",
        body: JSON.stringify({ decision: "fail", notes: "  " }),
        headers: { "Content-Type": "application/json", [ACCESS_HEADER]: await sign(claims()) },
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Say what needs to change before failing a plant." });
  });
});

describe("reviewerList", () => {
  it("trims, lowercases and drops blanks", () => {
    expect(reviewerList(" A@x.com,, b@Y.com ")).toEqual(["a@x.com", "b@y.com"]);
    expect(reviewerList(undefined)).toEqual([]);
  });
});
