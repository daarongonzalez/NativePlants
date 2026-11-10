import type { Route } from "./+types/admin.review";
import flowStyles from "../styles/flow.css?url";
import reviewStyles from "../styles/review.css?url";
import type { ReviewDecisionInput, ReviewListResponse } from "@np/shared";
import { api } from "../lib/api.server";
import { ReviewApp, ReviewUnavailable } from "../components/review/ReviewApp";

/**
 * The plant review page, for the horticultural reviewer only.
 *
 * Cloudflare Access guards /admin before a request reaches this Worker, and
 * adds a signed token to each request. This page passes the token on to the
 * API, which checks it again; the page itself trusts nothing.
 */
const ACCESS_HEADER = "Cf-Access-Jwt-Assertion";

const accessHeaders = (request: Request): Record<string, string> => {
  const token = request.headers.get(ACCESS_HEADER);
  return token ? { [ACCESS_HEADER]: token } : {};
};

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: flowStyles },
  { rel: "stylesheet", href: reviewStyles },
];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Plant review · nativo" }, { name: "robots", content: "noindex, nofollow" }];
}

export function headers() {
  return { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const result = await api<ReviewListResponse>(context, "/v1/admin/plants", { headers: accessHeaders(request) });
  return result.ok
    ? { ok: true as const, data: result.data }
    : { ok: false as const, status: result.status, error: result.error };
}

/** Never reload the whole list after a decision: the page already knows what changed. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: { formMethod?: string; defaultShouldRevalidate: boolean }) {
  return formMethod === "POST" ? false : defaultShouldRevalidate;
}

export async function action({ request, context }: Route.ActionArgs) {
  const body = (await request.json().catch(() => null)) as ({ plantId?: string } & Partial<ReviewDecisionInput>) | null;
  if (!body?.plantId || !body.decision) return { ok: false as const, plantId: body?.plantId ?? null, error: "That decision could not be read." };
  const { plantId, ...decision } = body;
  const result = await api<{ ok: true; reviewStatus: string; reviewId: string }>(
    context,
    `/v1/admin/plants/${encodeURIComponent(plantId)}/review`,
    { method: "POST", body: decision, headers: accessHeaders(request) },
  );
  return result.ok
    ? { ok: true as const, plantId, reviewStatus: result.data.reviewStatus, savedAt: new Date().toISOString() }
    : { ok: false as const, plantId, error: result.error };
}

export default function AdminReview({ loaderData }: Route.ComponentProps) {
  if (!loaderData.ok) return <ReviewUnavailable status={loaderData.status} error={loaderData.error} />;
  return <ReviewApp initial={loaderData.data} />;
}
