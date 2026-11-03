import type { KVNamespace } from "@cloudflare/workers-types";

export interface Env {
  HYPERDRIVE: { connectionString: string };
  AUTH_KEYS: KVNamespace;
  FIREBASE_PROJECT_ID: string;
  MARKET: string;
  /** "drafts" lets the plot planner offer draft plants, labelled; anything else means published only. */
  PLANNER_PLANTS?: string;
}

export interface Variables {
  owner: { userId: string };
  role: string;
}
