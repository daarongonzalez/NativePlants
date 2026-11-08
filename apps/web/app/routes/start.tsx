import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/start";
import flowStyles from "../styles/flow.css?url";
import { api } from "../lib/api.server";
import { MATCH_LABELS, placeToParams, type AddressMatch } from "../lib/flow";
import { FlowShell } from "../components/flow/Shell";
import { Window } from "../components/landing/primitives";

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: flowStyles },
];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Is this your yard? · nativo" }, { name: "robots", content: "noindex" }];
}

/** Step 1: find the address. Nothing is saved; the match travels in the link to the report. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const address = new URL(request.url).searchParams.get("address")?.trim() ?? "";
  if (address === "") throw redirect("/");

  const result = await api<{ match: AddressMatch }>(context, "/v1/public/lookup", {
    method: "POST",
    body: { address },
  });
  return result.ok ? { address, match: result.data.match, error: null } : { address, match: null, error: result.error };
}

function AddressAgain({ address, label }: { address: string; label: string }) {
  return (
    <Form method="get" action="/start" className="lp-address lp-address--green fl-address">
      <input
        className="lp-address__input"
        name="address"
        defaultValue={address}
        aria-label="Street address"
        autoComplete="street-address"
        required
        minLength={5}
      />
      <button type="submit" className="lp-button lp-button--green lp-address__button">
        {label}
      </button>
    </Form>
  );
}

export default function Start({ loaderData }: Route.ComponentProps) {
  const { address, match, error } = loaderData;

  if (!match) {
    return (
      <FlowShell step={1}>
        <section className="fl-head" aria-labelledby="start-title">
          <h1 id="start-title" className="lp-h2">
            We couldn't find that one
          </h1>
          <p className="lp-lead">{error}</p>
        </section>
        <AddressAgain address={address} label="Try again" />
      </FlowShell>
    );
  }

  const next = `/report?${placeToParams({ address: match.matchedAddress, ...match })}`;
  return (
    <FlowShell step={1}>
      <section className="fl-head" aria-labelledby="start-title">
        <span className="lp-badge lp-badge--sky">Step 1 · Your address</span>
        <h1 id="start-title" className="lp-h2">
          Is this <span className="lp-accent">your yard?</span>
        </h1>
      </section>

      <div className="fl-start">
        <Window label="address-check" tone="paper" size="lg" className="fl-start__window">
          <p className="fl-start__address">{match.matchedAddress}</p>
          <dl className="fl-facts">
            <div>
              <dt>Match</dt>
              <dd>{MATCH_LABELS[match.matchQuality]}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd className="np-value">
                {match.latitude.toFixed(5)}, {match.longitude.toFixed(5)}
              </dd>
            </div>
            <div>
              <dt>ZIP</dt>
              <dd className="np-value">{match.zip}</dd>
            </div>
          </dl>
          <p className="fl-source">US Census Bureau geocoder · you searched for “{address}”</p>
          {match.matchQuality !== "rooftop" && (
            <p className="fl-warn-line">
              We placed this along the street rather than on the building. That is close enough for your zone and
              frost dates. Soil maps can change within a block, so treat the soil as a guide.
            </p>
          )}
          <div className="fl-actions">
            <Link to={next} className="lp-button lp-button--green fl-button-link">
              Yes, show my ground
            </Link>
          </div>
        </Window>

        <aside className="lp-note lp-note--peach fl-note fl-note--right">
          <span className="lp-note__kicker">WHY IT MATTERS</span>
          <p>Soil can change within a single block, so we look up the exact spot, not just your ZIP code.</p>
          <p>No account needed, and we do not save your address.</p>
        </aside>
      </div>

      <section className="fl-again" aria-labelledby="again-title">
        <h2 id="again-title" className="lp-h3">
          Not quite right?
        </h2>
        <AddressAgain address={address} label="Search again" />
      </section>
    </FlowShell>
  );
}
