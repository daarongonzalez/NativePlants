import { describe, expect, it, vi } from "vitest";
import app from "./index";
import { isPlanLink, planEmail, sendPlanEmail } from "./email";

const LINK = "https://grownativo.com/plan/document?address=100+S+Example+St&p=eyJ2IjoxfQ";
const env = { RESEND_API_KEY: "re_test_key", EMAIL_FROM: "Nativo <plans@grownativo.com>", PUBLIC_SITE_ORIGIN: "https://grownativo.com" };

describe("plan email", () => {
  it("only sends a plan document on our own site", () => {
    expect(isPlanLink(LINK, "https://grownativo.com")).toBe(true);
    expect(isPlanLink("https://evil.example/plan/document?p=x", "https://grownativo.com")).toBe(false);
    expect(isPlanLink("https://grownativo.com/somewhere-else?p=x", "https://grownativo.com")).toBe(false);
    expect(isPlanLink("https://grownativo.com/plan/document", "https://grownativo.com")).toBe(false);
    expect(isPlanLink("javascript:alert(1)", "https://grownativo.com")).toBe(false);
  });

  it("sends one email through Resend with the link, and nothing else", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      return Response.json({ id: "email_1" });
    }) as typeof fetch;
    await expect(sendPlanEmail(env, { email: "gardener@example.com", link: LINK, area: "front yard" }, fetchImpl)).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect((calls[0]!.init.headers as Record<string, string>)["Authorization"]).toBe("Bearer re_test_key");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({ from: "Nativo <plans@grownativo.com>", to: ["gardener@example.com"], subject: "Your Nativo plan for your front yard" });
    expect(body.text).toContain(LINK);
    expect(body.html).toContain(LINK.replace(/&/g, "&amp;"));
  });

  it("says email is off when there is no key, without calling anyone", async () => {
    const fetchImpl = vi.fn();
    const out = await sendPlanEmail({}, { email: "a@example.com", link: LINK }, fetchImpl as unknown as typeof fetch);
    expect(out).toMatchObject({ ok: false, status: 503 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("tells the visitor plainly when Resend refuses the address or is down", async () => {
    const answer = (status: number) => (async () => new Response("{}", { status })) as typeof fetch;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sendPlanEmail(env, { email: "a@example.com", link: LINK }, answer(422))).resolves.toMatchObject({ ok: false, status: 422 });
    await expect(sendPlanEmail(env, { email: "a@example.com", link: LINK }, answer(500))).resolves.toMatchObject({ ok: false, status: 503 });
    vi.restoreAllMocks();
  });

  it("escapes the link in the HTML and keeps an unknown area generic", () => {
    const { subject, html } = planEmail('https://grownativo.com/plan/document?p="><script>', "<b>roof</b>");
    expect(subject).toBe("Your Nativo plan for your yard");
    expect(html).not.toContain("<script>");
  });

  it("the route refuses a bad address or a foreign link before sending", async () => {
    const post = (body: unknown) =>
      app.request("/v1/public/plan-email", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }, { HYPERDRIVE: { connectionString: "x" }, MARKET: "wasatch-front", ...env });
    expect((await post({ email: "not-an-email", link: LINK })).status).toBe(400);
    expect((await post({ email: "a@example.com", link: "https://evil.example/plan/document?p=x" })).status).toBe(400);
  });
});
