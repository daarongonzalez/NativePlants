import { z } from "zod";

/**
 * "Email me this plan", sent through Resend.
 *
 * The email holds one thing: a link to the gardener's plan document on our
 * own site. The route refuses any other link, so it cannot be used to send
 * arbitrary messages. Nothing is stored: the address goes to Resend to send
 * this one email and is not kept by us.
 *
 * Needs RESEND_API_KEY (a Worker secret) and a sending domain verified in
 * Resend. Without the key, the route says email is not switched on yet.
 */

export interface EmailEnv {
  RESEND_API_KEY?: string;
  /** e.g. "Nativo <plans@grownativo.com>". The domain must be verified in Resend. */
  EMAIL_FROM?: string;
  /** The site the plan link must point at. */
  PUBLIC_SITE_ORIGIN?: string;
}

const AREAS = new Set(["front yard", "backyard", "park strip", "area"]);

export const planEmailSchema = z.object({
  email: z.string().trim().email("Enter an email address we can send to.").max(254),
  link: z.string().max(6000),
  area: z.string().optional(),
});

/** Only a plan document on our own site may go in the email. */
export function isPlanLink(link: string, origin: string): boolean {
  try {
    const url = new URL(link);
    return url.origin === origin && url.pathname === "/plan/document" && url.searchParams.has("p");
  } catch {
    return false;
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function planEmail(link: string, area: string): { subject: string; text: string; html: string } {
  const what = AREAS.has(area) ? area : "yard";
  const subject = `Your Nativo plan for your ${what}`;
  const text = [
    `Here's your water-wise plan for your ${what}.`,
    "",
    `Open it: ${link}`,
    "",
    'On the plan page, choose "Save as PDF or print" to keep a copy. It has the drawing the rebate program asks for, the plants to buy, the rule checklist and the steps in order.',
    "",
    "The big one: apply while your lawn is still green, and do not start digging until the program has approved your project.",
    "",
    "Nativo · grownativo.com",
    "You're getting this because you asked for your plan. We have not added you to any list.",
  ].join("\n");
  const safe = escapeHtml(link);
  const html = `<!doctype html><html><body style="font-family: system-ui, sans-serif; line-height: 1.5; max-width: 560px;">
<p>Here's your water-wise plan for your ${escapeHtml(what)}.</p>
<p><a href="${safe}">Open your plan</a></p>
<p>On the plan page, choose <strong>Save as PDF or print</strong> to keep a copy. It has the drawing the rebate program asks for, the plants to buy, the rule checklist and the steps in order.</p>
<p><strong>The big one:</strong> apply while your lawn is still green, and do not start digging until the program has approved your project.</p>
<p>Nativo · grownativo.com<br><small>You're getting this because you asked for your plan. We have not added you to any list.</small></p>
</body></html>`;
  return { subject, text, html };
}

export type SendOutcome = { ok: true } | { ok: false; status: 400 | 422 | 503; error: string };

export async function sendPlanEmail(
  env: EmailEnv,
  input: z.infer<typeof planEmailSchema>,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): Promise<SendOutcome> {
  const origin = env.PUBLIC_SITE_ORIGIN?.trim() || "https://grownativo.com";
  if (!isPlanLink(input.link, origin)) return { ok: false, status: 400, error: "That is not a Nativo plan link." };
  const key = env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, status: 503, error: "Email isn't switched on yet. You can still save this plan as a PDF." };

  const { subject, text, html } = planEmail(input.link, input.area ?? "area");
  let res: Response;
  try {
    res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM?.trim() || "Nativo <plans@grownativo.com>", to: [input.email], subject, text, html }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return { ok: false, status: 503, error: "We could not send email just now. Try again in a moment, or save the plan as a PDF." };
  }
  if (res.ok) return { ok: true };
  // Resend answers 4xx for an address it will not send to, 5xx when it is having trouble.
  if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 403) {
    return { ok: false, status: 422, error: "We could not send to that address. Check it and try again." };
  }
  console.error(JSON.stringify({ level: "error", where: "plan email", status: res.status }));
  return { ok: false, status: 503, error: "We could not send email just now. Try again in a moment, or save the plan as a PDF." };
}
