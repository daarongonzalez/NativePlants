import type { KVNamespace } from "@cloudflare/workers-types";

export interface Env {
  HYPERDRIVE: { connectionString: string };
  AUTH_KEYS: KVNamespace;
  FIREBASE_PROJECT_ID: string;
  MARKET: string;
  /** "drafts" lets the plot planner offer draft plants, labelled; anything else means published only. */
  PLANNER_PLANTS?: string;
  /** Cloudflare Access team domain for the review page, e.g. "nativo.cloudflareaccess.com". */
  ACCESS_TEAM_DOMAIN?: string;
  /** The Access application's Audience (AUD) tag. Not a secret: it names the app, it does not unlock it. */
  ACCESS_AUD?: string;
  /** Comma-separated emails allowed to review plants. Checked as well as the Access policy. */
  REVIEWER_EMAILS?: string;
}

export interface Variables {
  owner: { userId: string };
  role: string;
}
