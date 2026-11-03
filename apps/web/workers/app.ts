import { createRequestHandler } from "react-router";

/**
 * What the web Worker is bound to. The API is reached through a service
 * binding (no public hop, no CORS). API_URL is the fallback for local
 * development, set in .dev.vars, when the API Worker is not bound.
 */
export interface WebEnv {
  API?: Fetcher;
  API_URL?: string;
}

declare module "react-router" {
  interface AppLoadContext {
    cloudflare: { env: WebEnv; ctx: ExecutionContext };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    return requestHandler(request, { cloudflare: { env, ctx } });
  },
} satisfies ExportedHandler<WebEnv>;
