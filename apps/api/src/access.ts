import type { MiddlewareHandler } from "hono";
import type { Env } from "./env";

/**
 * Cloudflare Access, checked again in the API.
 *
 * Access sits in front of the review page and only lets in the emails its
 * policy names. On every request it lets through, it adds a signed token in
 * the `Cf-Access-Jwt-Assertion` header. The web app passes that header on,
 * and these checks make sure the API never takes a reviewer's word for it:
 *
 *  1. The token is signed by our Access team's own keys (RS256).
 *  2. It was issued for the review application (`aud`) by our team (`iss`).
 *  3. It has not expired.
 *  4. Its email is on REVIEWER_EMAILS as well. Two lists to change is a small
 *     price for a mistake in one of them not opening the door.
 *
 * With any of the settings missing, every admin route answers 503: closed by
 * default, never open by default.
 */

export const ACCESS_HEADER = "Cf-Access-Jwt-Assertion";

export interface AccessConfig {
  /** e.g. "nativo.cloudflareaccess.com" */
  teamDomain: string;
  /** The Application Audience (AUD) tag of the Access application. */
  aud: string;
}

export interface AccessClaims {
  email: string;
  aud: string[];
  iss: string;
  exp: number;
  sub?: string;
}

type Jwk = JsonWebKey & { kid?: string };
export type CertFetcher = (teamDomain: string) => Promise<Jwk[]>;

const b64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
const decodeJson = <T>(s: string): T => JSON.parse(new TextDecoder().decode(b64url(s))) as T;

/** Access publishes its signing keys here. They rotate, so they are cached for ten minutes, not forever. */
let cache: { teamDomain: string; keys: Jwk[]; at: number } | null = null;
export const fetchAccessCerts: CertFetcher = async (teamDomain) => {
  if (cache && cache.teamDomain === teamDomain && Date.now() - cache.at < 10 * 60_000) return cache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Access certs: HTTP ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  cache = { teamDomain, keys: body.keys ?? [], at: Date.now() };
  return cache.keys;
};

/** Checks a token. Returns its claims, or a short reason it was refused. */
export async function verifyAccessToken(
  token: string,
  config: AccessConfig,
  fetchCerts: CertFetcher = fetchAccessCerts,
  now: number = Date.now(),
): Promise<{ ok: true; claims: AccessClaims } | { ok: false; reason: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [h, p, sig] = parts as [string, string, string];

  let header: { alg?: string; kid?: string };
  let claims: AccessClaims;
  try {
    header = decodeJson(h);
    claims = decodeJson(p);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (header.alg !== "RS256") return { ok: false, reason: "wrong algorithm" };

  const keys = await fetchCerts(config.teamDomain);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return { ok: false, reason: "unknown key" };

  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!valid) return { ok: false, reason: "bad signature" };

  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(config.aud)) return { ok: false, reason: "wrong audience" };
  if (claims.iss !== `https://${config.teamDomain}`) return { ok: false, reason: "wrong issuer" };
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) return { ok: false, reason: "expired" };
  if (typeof claims.email !== "string" || claims.email === "") return { ok: false, reason: "no email" };

  return { ok: true, claims: { ...claims, aud } };
}

export const reviewerList = (raw: string | undefined) =>
  (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/**
 * Lets a request through only if it carries a valid Access token for a
 * listed reviewer. Sets `reviewer` to their email.
 */
export function requireReviewer(
  fetchCerts: CertFetcher = fetchAccessCerts,
): MiddlewareHandler<{ Bindings: Env; Variables: { reviewer: string } }> {
  return async (c, next) => {
    const teamDomain = c.env.ACCESS_TEAM_DOMAIN?.trim();
    const aud = c.env.ACCESS_AUD?.trim();
    const reviewers = reviewerList(c.env.REVIEWER_EMAILS);
    if (!teamDomain || !aud || reviewers.length === 0) {
      return c.json({ error: "The review page is not set up yet: Cloudflare Access settings are missing." }, 503);
    }

    const token = c.req.header(ACCESS_HEADER);
    if (!token) return c.json({ error: "Sign in through Cloudflare Access to review plants." }, 401);

    let result;
    try {
      result = await verifyAccessToken(token, { teamDomain, aud }, fetchCerts);
    } catch (error) {
      console.error("access check failed", error);
      return c.json({ error: "We could not check your sign-in just now. Try again in a moment." }, 503);
    }
    if (!result.ok) {
      // The reason goes to the log, not the response: it helps us, not someone probing.
      console.warn("access token refused:", result.reason);
      return c.json({ error: "Your sign-in has expired or is not valid. Reload the page to sign in again." }, 401);
    }

    const email = result.claims.email.toLowerCase();
    if (!reviewers.includes(email)) {
      console.warn("access: signed in but not a reviewer", email);
      return c.json({ error: "You're signed in, but not set up as a plant reviewer." }, 403);
    }

    c.set("reviewer", email);
    await next();
  };
}
