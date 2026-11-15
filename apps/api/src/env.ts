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
  /** A Slack or Discord incoming webhook for error alerts. A Worker secret; optional. */
  ALERT_WEBHOOK_URL?: string;
  /** Resend, for "Email me this plan". A Worker secret; without it email is off. */
  RESEND_API_KEY?: string;
  /** The sender, e.g. "Nativo <plans@grownativo.com>". Its domain must be verified in Resend. */
  EMAIL_FROM?: string;
  /** The live site. Plan emails may only link to plan documents here. */
  PUBLIC_SITE_ORIGIN?: string;
}

export interface Variables {
  owner: { userId: string };
  role: string;
}
