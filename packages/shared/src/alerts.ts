/**
 * Error alerts. Every unexpected error is logged as one line of JSON (kept by
 * Cloudflare's Workers Logs), and, when ALERT_WEBHOOK_URL is set, posted to a
 * chat channel: a Slack or Discord incoming webhook both work.
 *
 * Two rules keep this safe to leave on:
 *  - No personal data. Addresses travel in our page links, so only the path
 *    is reported, never the query string, and messages are cut short.
 *  - No floods. The same error from the same place alerts once per ten
 *    minutes per Worker instance; the logs still have every occurrence.
 */

export interface AlertEnv {
  /** A Slack or Discord incoming webhook. A Worker secret, never in the code. */
  ALERT_WEBHOOK_URL?: string;
}

export interface WaitUntil {
  waitUntil(promise: Promise<unknown>): void;
}

const QUIET_MS = 10 * 60_000;
const recent = new Map<string, number>();

/** The path of a URL without its query string, which can hold an address. */
export function safePath(url: string | URL | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(String(url)).pathname;
  } catch {
    return String(url).split("?")[0] ?? null;
  }
}

function describe(error: unknown): { name: string; message: string; stack: string | null } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message.slice(0, 300), stack: error.stack?.split("\n").slice(0, 6).join("\n") ?? null };
  }
  return { name: "NonError", message: String(error).slice(0, 300), stack: null };
}

/**
 * Logs an error, and posts an alert if a webhook is set. Never throws: a
 * broken alert must not break the page that hit the error.
 */
export function reportError(
  env: AlertEnv | undefined,
  where: string,
  error: unknown,
  options: { url?: string | URL; ctx?: WaitUntil; fetchImpl?: typeof fetch; now?: number } = {},
): Promise<void> | null {
  const { name, message, stack } = describe(error);
  const path = safePath(options.url);
  console.error(JSON.stringify({ level: "error", where, path, name, message, stack }));

  const hook = env?.ALERT_WEBHOOK_URL?.trim();
  if (!hook) return null;

  const now = options.now ?? Date.now();
  const key = `${where}|${name}|${message}`;
  const last = recent.get(key);
  if (last !== undefined && now - last < QUIET_MS) return null;
  recent.set(key, now);
  // Forget old keys, so a long-lived instance does not grow without end.
  if (recent.size > 200) {
    for (const [k, t] of recent) if (now - t >= QUIET_MS) recent.delete(k);
  }

  const text = `nativo error in ${where}${path ? ` (${path})` : ""}: ${name}: ${message}`;
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const sent = fetchImpl(hook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Slack reads `text`, Discord reads `content`; each ignores the other.
    body: JSON.stringify({ text, content: text }),
  })
    .then(() => undefined)
    .catch((e: unknown) => console.error(JSON.stringify({ level: "error", where: "alert", message: String(e).slice(0, 200) })));
  options.ctx?.waitUntil(sent);
  return sent;
}

/** For tests: start with no remembered alerts. */
export function resetAlertMemory() {
  recent.clear();
}
