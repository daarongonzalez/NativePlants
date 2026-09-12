import type { KVNamespace } from "@cloudflare/workers-types";

export interface Env {
  HYPERDRIVE: { connectionString: string };
  AUTH_KEYS: KVNamespace;
  FIREBASE_PROJECT_ID: string;
  MARKET: string;
}

export interface Variables {
  owner: { userId: string };
  role: string;
}
