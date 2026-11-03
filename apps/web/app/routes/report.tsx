import { Link, redirect } from "react-router";
import type { Route } from "./+types/report";
import landingStyles from "../styles/landing.css?url";
import flowStyles from "../styles/flow.css?url";
import { sunExposureSchema, textureClass } from "@np/shared";
import grass from "../../../../design/nativo/assets/Grass/grass-07-cream.svg?url";
import { api } from "../lib/api.server";
import {
  DRAINAGE_LABELS,
  PROGRAM_CODE,
  TEXTURE_LABELS,
  formatDate,
  formatDollars,
  phMeaning,
  placeFromParams,
  placeToParams,
  type ProfileResponse,
  type ProgramResponse,
} from "../lib/flow";
import { FlowShell } from "../components/flow/Shell";
import { AttributedValue } from "../components/flow/Attributed";
import { FrostBand, SoilColumn, SunQuestion } from "../components/flow/ReportParts";
import { Stat, Window } from "../components/landing/primitives";


export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: landingStyles },
  { rel: "stylesheet", href: flowStyles },
];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Your ground · nativo" }, { name: "robots", content: "noindex" }];
}

/** Step 2: the site profile, built fresh from public data and not saved. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  const place = placeFromParams(params);
  if (!place) throw redirect("/");
  const sun = sunExposureSchema.safeParse(params.get("sun")).data ?? null;

  const [profile, program] = await Promise.all([
    api<ProfileResponse>(context, "/v1/public/profile", {
      method: "POST",
      body: {
        latitude: place.latitude,
        longitude: place.longitude,
        zip: place.zip,
        matchQuality: place.matchQuality,
        ...(sun ? { sunExposure: sun } : {}),
      },
    }),
    api<ProgramResponse>(context, `/v1/public/rebates/${PROGRAM_CODE}`),
  ]);

  return {
    place,
    sun,
    profile: profile.ok ? profile.data : null,
    error: profile.ok ? null : profile.error,
    program: program.ok ? program.data.program : null,
  };
}

export default function Report({ loaderData }: Route.ComponentProps) {
  const { place, sun, profile, error, program } = loaderData;
  const placeParams = Object.fromEntries(new URLSearchParams(placeToParams(place)));
  const planHref = `/plan?${placeToParams(place)}`;

  if (!profile) {
    return (
      <FlowShell step={2}>
        <section className="fl-head" aria-labelledby="report-title">
          <h1 id="report-title" className="lp-h2">
            We can't build this one yet
          </h1>
          <p className="lp-lead">{error}</p>
          <Link to="/" className="lp-button lp-button--green fl-button-link">
            Try another address
          </Link>
        </section>
      </FlowShell>
    );
  }

  const { values, provenance, detail, caveats } = profile;
  const texture =
    values.sandPct !== null && values.siltPct !== null && values.clayPct !== null
      ? TEXTURE_LABELS[textureClass(values.sandPct, values.siltPct, values.clayPct)]
      : null;

  return (
    <FlowShell step={2}>
      <section className="fl-head" aria-labelledby="report-title">
        <span className="lp-badge lp-badge--sky">Step 2 · Your ground</span>
        <h1 id="report-title" className="lp-h2">
          Here's what your <span className="lp-accent">ground</span> is like
        </h1>
        <p className="fl-head__address np-value">{place.address}</p>
        <p className="lp-body">Built just now from public soil and climate data. Every number says where it came from.</p>
      </section>

      <div className="fl-report">
        <Window label="soil · top 12 inches" number={1} tone="paper" className="fl-report__soil">
          {detail.soil && detail.soil.measured ? (
            <div className="fl-soil-grid">
              <SoilColumn soil={detail.soil} />
              <div className="fl-values">
                {values.ph !== null && (
                  <AttributedValue
                    label="Soil pH"
                    value={values.ph.toFixed(1)}
                    meaning={phMeaning(values.ph)}
                    provenance={provenance["ph"]}
                    showNote={false}
                  />
                )}
                {texture && (
                  <AttributedValue
                    label="Texture"
                    value={texture}
                    meaning={`${Math.round(values.sandPct!)}% sand · ${Math.round(values.siltPct!)}% silt · ${Math.round(values.clayPct!)}% clay`}
                    provenance={provenance["clayPct"]}
                    words
                    showNote={false}
                  />
                )}
                {values.drainageClass && (
                  <AttributedValue
                    label="Drainage"
                    value={DRAINAGE_LABELS[values.drainageClass] ?? values.drainageClass}
                    provenance={provenance["drainageClass"]}
                    words
                    showNote={false}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="fl-empty">
              <p className="lp-h3-card">No soil reading here</p>
              <p className="lp-body-sm">
                {detail.soil
                  ? `The county survey maps this spot as “${detail.soil.name}”, which it does not measure. Built-up ground is often fill, so a home soil test is the reliable answer.`
                  : "The county soil survey has no map for this spot. A home soil test would fill the gap."}
              </p>
            </div>
          )}
        </Window>

        <Window label="climate" number={2} tone="paper" className="fl-report__climate">
          <AttributedValue
            label="Hardiness zone"
            value={profile.zone}
            meaning="The coldest winters your plants need to survive"
            provenance={provenance["zoneOrdinal"]}
          />
          {detail.frostStation ? (
            <>
              <FrostBand frost={detail.frostStation} />
              <p className="fl-source">
                NOAA {detail.frostStation.normalsPeriod} climate normals · {detail.frostStation.name},{" "}
                {detail.frostStation.distanceKm} km away · about {detail.frostStation.frostFreeDays} frost-free days a year
              </p>
            </>
          ) : (
            <p className="lp-body-sm">No weather station with frost records is near enough to say.</p>
          )}
        </Window>

        <Window label="sun" number={3} tone="paper" className="fl-report__sun">
          <AttributedValue
            label="Direct sun on a summer day"
            value={Math.round(values.sunHoursSummer)}
            unit="hours"
            provenance={provenance["sunHoursSummer"]}
          />
          <SunQuestion current={sun} hidden={placeParams} />
        </Window>

        {caveats.length > 0 && (
          <aside className="lp-note lp-note--sky fl-note fl-note--left fl-report__caveats">
            <span className="lp-note__kicker">WORTH KNOWING</span>
            <ul className="fl-list">
              {caveats.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      <div className="lp-band lp-band--green fl-cta-band">
        <section className="fl-cta" aria-labelledby="cta-title">
          <img src={grass} alt="" className="fl-cta__grass" />
          <div className="fl-cta__copy">
            <span className="lp-badge lp-badge--gold">Step 3</span>
            <h2 id="cta-title" className="lp-h2">
              Now plan your rebate
            </h2>
            <p className="lp-body-lg">
              Lay out your yard square by square. We check it against Utah's rules as you go and add up what the
              program could pay.
            </p>
            <Link to={planHref} className="lp-button lp-button--gold fl-button-link fl-button-link--lg">
              Open the plot planner
            </Link>
          </div>
          {program && program.perSqftAmount !== null && (
            <div className="fl-cta__stat">
              <Stat
                label="Utah pays up to"
                value={`${formatDollars(program.perSqftAmount)} a sq ft`}
                source={`${program.name} · checked ${formatDate(program.verifiedAt)}`}
                tone="gold"
              />
            </div>
          )}
        </section>
      </div>
    </FlowShell>
  );
}
