import { Auth, WorkersKVStoreSingle } from "firebase-auth-cloudflare-workers";
import type { MiddlewareHandler } from "hono";
import { createDatabase, findOrCreateUser } from "@np/db";
import type { Env, Variables } from "./env.js";

/**
 * Verifies a Firebase ID token at the edge.
 *
 * `firebase-admin` depends on Node internals and will not run on Workers, so
 * verification goes through a Web Crypto implementation instead, with Google's
 * public keys cached in KV.
 *
 * Two rules this enforces:
 *
 *  1. The caller's identity comes from the verified token and nowhere else —
 *     never from a header, query parameter, or request body.
 *  2. The role comes from Postgres, not from a custom claim. A claim lives
 *     inside an issued token and can be up to an hour stale, which is a long
 *     time to leave a revoked account with write access.
 */
export const requireAuth: MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> = async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Sign in to continue." }, 401);
  }

  const token = header.slice("Bearer ".length);

  let decoded;
  try {
    const auth = Auth.getOrInitialize(
      c.env.FIREBASE_PROJECT_ID,
      WorkersKVStoreSingle.getOrInitialize(c.env.FIREBASE_PROJECT_ID, c.env.AUTH_KEYS),
    );
    decoded = await auth.verifyIdToken(token, false);
  } catch {
    // Deliberately vague: distinguishing expired from malformed from
    // wrong-project tells an attacker more than it helps a user.
    return c.json({ error: "Your session has expired. Sign in again." }, 401);
  }

  const email = typeof decoded.email === "string" ? decoded.email : null;
  if (!email) {
    return c.json({ error: "This account has no email address associated with it." }, 403);
  }

  const db = createDatabase(c.env.HYPERDRIVE.connectionString);
  const user = await findOrCreateUser(db, decoded.uid, email);

  c.set("owner", { userId: user.id });
  c.set("role", user.role);

  await next();
};

/** Retailer and admin routes. Unused in V1; the shape is fixed now. */
export function requireRole(...allowed: string[]): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> {
  return async (c, next) => {
    if (!allowed.includes(c.get("role"))) {
      return c.json({ error: "You do not have access to this." }, 403);
    }
    await next();
  };
}
