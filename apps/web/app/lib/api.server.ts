import type { AppLoadContext } from "react-router";

/**
 * Calls the API Worker from a loader or action. Uses the service binding when
 * there is one, and API_URL in local development.
 *
 * Returns the status and parsed body rather than throwing, so each page can
 * show its own plain error instead of a generic one.
 */
export async function api<T>(
  context: AppLoadContext,
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const { env } = context.cloudflare;
  const request = new Request(`${env.API_URL ?? "https://api.internal"}${path}`, {
    method: init.method ?? "GET",
    headers: { ...(init.body === undefined ? {} : { "Content-Type": "application/json" }), ...init.headers },
    body: init.body === undefined ? null : JSON.stringify(init.body),
  });

  let response: Response;
  try {
    response = env.API && !env.API_URL ? await env.API.fetch(request) : await fetch(request);
  } catch (error) {
    console.error("api unreachable", path, error);
    return { ok: false, status: 503, error: "We could not reach our data just now. Please try again in a moment." };
  }

  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || body === null) {
    return { ok: false, status: response.status, error: body?.error ?? "Something went wrong on our end." };
  }
  return { ok: true, data: body };
}
