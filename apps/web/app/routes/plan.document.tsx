import { data, Form, Link, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/plan.document";
import flowStyles from "../styles/flow.css?url";
import docStyles from "../styles/plan-document.css?url";
import { checkPlan, plantsForSquares } from "@np/engine";
import { SQUARE_FT, textureClass, type PlanPlant, type RuleOutcome, type RuleStage } from "@np/shared";
import { api } from "../lib/api.server";
import { enforceLimit } from "../lib/limits.server";
import {
  DRAINAGE_LABELS,
  PROGRAM_CODE,
  TEXTURE_LABELS,
  formatDate,
  formatDollars,
  formatMonthDay,
  formatNumber,
  inches,
  placeToParams,
  type ProfileResponse,
  type ProgramResponse,
} from "../lib/flow";
import { SITE_ORIGIN } from "../lib/meta";
import { planFromParams, encodePlan } from "../lib/plan-link";
import { plantColor } from "../lib/planner";
import { RESULT_LABELS } from "../components/flow/Planner";
import { Nav } from "../components/landing/Nav";
import { tokenColor } from "../components/landing/primitives";

/**
 * The plan document: everything a gardener needs to apply for the rebate and
 * buy the plants, laid out for paper. "Save as PDF" in the browser's print
 * dialog makes the PDF. The plan travels in the link, so nothing is stored.
 */

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: flowStyles },
  { rel: "stylesheet", href: docStyles },
];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Your plan · nativo" }, { name: "robots", content: "noindex" }];
}

const KEY = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export async function loader({ request, context }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  const link = planFromParams(params);
  if (!link) throw data(null, { status: 404 });
  await enforceLimit(context, request, "estimate");

  const { plan, place } = link;
  const [programRes, profileRes] = await Promise.all([
    api<ProgramResponse>(context, `/v1/public/rebates/${PROGRAM_CODE}`),
    place
      ? api<ProfileResponse>(context, "/v1/public/profile", {
          method: "POST",
          body: { latitude: place.latitude, longitude: place.longitude, zip: place.zip, matchQuality: place.matchQuality },
        })
      : Promise.resolve(null),
  ]);
  if (!programRes.ok) throw data(null, { status: 503 });
  const { program, plants } = programRes.data;

  const ids = [...new Set(plan.cells.flatMap((c) => (c.kind === "plant" ? [c.plantId] : [])))];
  const used = ids.map((id) => plants.find((p) => p.id === id)).filter((p): p is PlanPlant => Boolean(p));
  // A plant that is no longer offered cannot be checked or bought: say so rather than guess.
  const missing = ids.length - used.length;
  const check = checkPlan(program, plan, used);

  return {
    plan,
    place,
    program,
    used,
    missing,
    check,
    profile: profileRes && profileRes.ok ? profileRes.data : null,
    createdOn: new Date().toISOString(),
    planCode: encodePlan(plan),
  };
}

/** "Email me this plan": sends the link to this page, nothing else. */
export async function action({ request, context }: Route.ActionArgs) {
  await enforceLimit(context, request, "email");
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const url = new URL(request.url);
  const link = `${SITE_ORIGIN}${url.pathname}${url.search}`;
  const result = await api<{ ok: true }>(context, "/v1/public/plan-email", {
    method: "POST",
    body: { email, link, area: String(form.get("area") ?? "") },
  });
  return result.ok ? { ok: true as const, email } : { ok: false as const, error: result.error };
}

const AREA_NAMES: Record<string, string> = { front: "front yard", back: "backyard", park_strip: "park strip" };
const STAGE_LABELS: Record<RuleStage, string> = {
  application: "When you apply",
  site_visit: "At the first site visit",
  completion: "When you finish",
  paperwork: "Before you are paid",
};

function PlanDrawing({ plan, keyOf }: { plan: Route.ComponentProps["loaderData"]["plan"]; keyOf: (id: string) => { letter: string; color: string } }) {
  const cols = plan.widthFt / SQUARE_FT;
  const rows = plan.depthFt / SQUARE_FT;
  const s = 10; // drawing units per square
  const W = cols * s;
  const H = rows * s;
  const pad = 8;
  const streetSide = plan.areaKind !== "back";
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${W + pad * 2} ${H + pad * 3}`}
      className="pd-drawing"
      role="img"
      aria-label={`Plan drawing, ${plan.widthFt} by ${plan.depthFt} feet, in 5 foot squares`}
    >
      <text x={W / 2} y={-2} textAnchor="middle" className="pd-edge-label">
        {plan.areaKind === "back" ? "back fence" : "house side"}
      </text>
      {plan.cells.map((cell, i) => {
        const x = (i % cols) * s;
        const y = Math.floor(i / cols) * s;
        if (cell.kind === "plant") {
          const k = keyOf(cell.plantId);
          return (
            <g key={i}>
              <rect x={x} y={y} width={s} height={s} className="pd-cell pd-cell--plant" style={tokenColor(k.color)} />
              <text x={x + s / 2} y={y + s / 2 + 2} textAnchor="middle" className="pd-cell-letter">
                {k.letter}
              </text>
            </g>
          );
        }
        return <rect key={i} x={x} y={y} width={s} height={s} className={`pd-cell pd-cell--${cell.kind}`} />;
      })}
      <rect x={0} y={0} width={W} height={H} className="pd-outline" />
      <text x={W / 2} y={H + 7} textAnchor="middle" className="pd-edge-label">
        {streetSide ? "street side" : "house side"}
      </text>
      {/* Scale: 10 ft. */}
      <line x1={0} y1={H + 14} x2={2 * s} y2={H + 14} className="pd-scale" />
      <text x={2 * s + 2} y={H + 15.5} className="pd-scale-label">
        10 ft
      </text>
    </svg>
  );
}

export default function PlanDocument({ loaderData }: Route.ComponentProps) {
  const { plan, place, program, used, missing, check, profile, createdOn, planCode } = loaderData;
  const sent = useActionData<typeof action>();
  const sending = useNavigation().state === "submitting";

  const keyMap = new Map(used.map((p, i) => [p.id, { letter: KEY[i] ?? "?", color: plantColor(p) }]));
  const keyOf = (id: string) => keyMap.get(id) ?? { letter: "?", color: "--soil" };
  const squaresOf = (id: string) => plan.cells.filter((c) => c.kind === "plant" && c.plantId === id).length;
  const mulch = plan.cells.filter((c) => c.kind === "mulch").length;
  const area = AREA_NAMES[plan.areaKind] ?? "area";
  const drafts = used.some((p) => p.reviewStatus !== "published");
  const planChecks = check.outcomes.filter((o) => o.checkType === "plan_check");
  const others = program.rules.filter((r) => r.checkType !== "plan_check");
  const blackout =
    program.inspectionBlackoutStart && program.inspectionBlackoutEnd
      ? `${formatMonthDay(program.inspectionBlackoutStart)} to ${formatMonthDay(program.inspectionBlackoutEnd)}`
      : null;
  const v = profile?.values;
  const texture = v && v.sandPct !== null && v.siltPct !== null && v.clayPct !== null ? TEXTURE_LABELS[textureClass(v.sandPct, v.siltPct, v.clayPct)] : null;
  const planHref = `/plan?${new URLSearchParams({ ...(place ? Object.fromEntries(new URLSearchParams(placeToParams(place))) : {}), p: planCode }).toString()}`;

  return (
    <div className="lp pd">
      <div className="no-print">
        <Nav />
      </div>
      <main className="lp-wrap pd-main">
        <div className="pd-toolbar no-print">
          <button type="button" className="lp-button lp-button--green fl-button-link" onClick={() => window.print()}>
            Save as PDF or print
          </button>
          <Link to={planHref} className="lp-button lp-button--paper fl-button-link">
            Edit in the planner
          </Link>
          <span className="fl-source">In the print window, choose "Save as PDF" as the printer.</span>
        </div>

        <header className="pd-head">
          <p className="pd-brand">
            <span className="lp-wordmark">nativo</span> <span className="np-value">your plan · {formatDate(createdOn)}</span>
          </p>
          <h1 className="lp-h2">
            A water-wise <span className="lp-accent">{area}</span>
          </h1>
          {place?.address && <p className="np-value pd-address">{place.address}</p>}
          <dl className="pd-summary">
            <div>
              <dt>Area</dt>
              <dd className="np-value">
                {plan.widthFt} × {plan.depthFt} ft · {formatNumber(plan.widthFt * plan.depthFt)} sq ft
              </dd>
            </div>
            <div>
              <dt>Plant cover when grown</dt>
              <dd className="np-value">about {Math.round(check.coveragePct)}%</dd>
            </div>
            <div>
              <dt>Estimated rebate</dt>
              <dd className="np-value">{formatDollars(check.estimatedAmount)}</dd>
            </div>
          </dl>
          {(drafts || missing > 0) && (
            <p className="pd-warn">
              {drafts ? "Some plant details are drafts awaiting expert review. " : ""}
              {missing > 0 ? `${missing} plant${missing === 1 ? " is" : "s are"} no longer offered and left out of this document.` : ""}
            </p>
          )}
        </header>

        <section className="pd-section pd-section--drawing" aria-labelledby="pd-drawing-title">
          <h2 id="pd-drawing-title" className="lp-h3">
            1. The plan, seen from above
          </h2>
          <p className="lp-body-sm">Each square is 5 by 5 ft. Letters match the plant list. This is the drawing the program asks for.</p>
          <div className="pd-drawing-wrap">
            <PlanDrawing plan={plan} keyOf={keyOf} />
            <ul className="pd-key">
              {used.map((p) => (
                <li key={p.id}>
                  <span className="pd-key__swatch" style={tokenColor(keyOf(p.id).color)}>
                    {keyOf(p.id).letter}
                  </span>
                  {p.commonName}
                </li>
              ))}
              {mulch > 0 && (
                <li>
                  <span className="pd-key__swatch pd-key__swatch--mulch" /> Mulch, 3 to 4 in deep
                </li>
              )}
            </ul>
          </div>
        </section>

        <section className="pd-section" aria-labelledby="pd-plants-title">
          <h2 id="pd-plants-title" className="lp-h3">
            2. Plants to buy
          </h2>
          <table className="pd-table">
            <thead>
              <tr>
                <th scope="col">Key</th>
                <th scope="col">Plant</th>
                <th scope="col">How many</th>
                <th scope="col">Grown size</th>
              </tr>
            </thead>
            <tbody>
              {used.map((p) => (
                <tr key={p.id}>
                  <td className="np-value">{keyOf(p.id).letter}</td>
                  <th scope="row">
                    {p.commonName}
                    <span className="np-sci-name">{p.scientificName}</span>
                  </th>
                  <td className="np-value">{plantsForSquares(squaresOf(p.id), p.matureWidthCm)}</td>
                  <td className="np-value">
                    {inches(p.matureHeightCm)} in tall · {inches(p.matureWidthCm)} in wide
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fl-source">
            Counts space each plant at its grown width. Ask the nursery for each plant by its scientific name. Smaller pots cost
            less and settle in well.
          </p>
        </section>

        <section className="pd-section" aria-labelledby="pd-rules-title">
          <h2 id="pd-rules-title" className="lp-h3">
            3. The rebate rules
          </h2>
          <ul className="pd-rules">
            {planChecks.map((o: RuleOutcome) => (
              <li key={o.code} className={`pd-rule pd-rule--${o.result}`}>
                <span className="pd-rule__result">{RESULT_LABELS[o.result]}</span>
                <span>
                  <strong>{o.title}.</strong> {o.note}
                </span>
              </li>
            ))}
          </ul>
          {(Object.keys(STAGE_LABELS) as RuleStage[]).map((stage) => {
            const rules = others.filter((r) => r.stage === stage);
            if (rules.length === 0) return null;
            return (
              <div key={stage} className="pd-stage">
                <h3 className="pd-stage__title">{STAGE_LABELS[stage]}</h3>
                <ul className="pd-checklist">
                  {rules.map((r) => (
                    <li key={r.code}>
                      <span className="pd-box" aria-hidden="true" />
                      <span>
                        <strong>{r.title}.</strong> {r.plainText}{" "}
                        <span className="fl-muted">({r.checkType === "inspector_only" ? "the inspector checks" : "you confirm"})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        <section className="pd-section" aria-labelledby="pd-steps-title">
          <h2 id="pd-steps-title" className="lp-h3">
            4. What to do, in order
          </h2>
          <ol className="pd-steps">
            <li>
              <strong>Apply while your lawn is still green.</strong> Send photos of the lawn now, this drawing and a short
              description to the {program.name}
              {program.applicationUrl ? ` (${program.applicationUrl.replace(/^https?:\/\//, "")})` : ""}.
            </li>
            <li>
              <strong>Wait for the site visit and approval.</strong> Do not dig before then: work started early is not paid for.
            </li>
            <li>
              <strong>Remove the lawn, lay drip, plant and mulch.</strong> Drip only, on its own zone, with a filter and pressure
              reducer.
            </li>
            <li>
              <strong>Finish within {program.completionMonths ?? 12} months</strong> of the first visit.
              {blackout ? ` Inspections usually pause from ${blackout} in cities with secondary water, so plan around that.` : ""}
            </li>
            <li>
              <strong>Pass the final inspection, then sign the agreement and tax form.</strong> The payment goes to the property owner.
            </li>
          </ol>
        </section>

        {v && (
          <section className="pd-section" aria-labelledby="pd-ground-title">
            <h2 id="pd-ground-title" className="lp-h3">
              5. Your ground
            </h2>
            <dl className="pd-summary pd-summary--ground">
              <div>
                <dt>Hardiness zone</dt>
                <dd className="np-value">{profile!.zone}</dd>
              </div>
              {profile!.detail.frostStation && (
                <div>
                  <dt>Last spring frost (typical)</dt>
                  <dd className="np-value">{formatMonthDay(profile!.detail.frostStation.lastSpringP50)}</dd>
                </div>
              )}
              {v.ph !== null && (
                <div>
                  <dt>Soil pH</dt>
                  <dd className="np-value">{v.ph.toFixed(1)}</dd>
                </div>
              )}
              {texture && (
                <div>
                  <dt>Soil texture</dt>
                  <dd>{texture}</dd>
                </div>
              )}
              {v.drainageClass && (
                <div>
                  <dt>Drainage</dt>
                  <dd>{DRAINAGE_LABELS[v.drainageClass] ?? v.drainageClass}</dd>
                </div>
              )}
              <div>
                <dt>Summer sun</dt>
                <dd className="np-value">{Math.round(v.sunHoursSummer)} hours</dd>
              </div>
            </dl>
            <p className="fl-source">
              USDA county soil survey · USDA Plant Hardiness Zone Map · NOAA 1991–2020 climate normals · sun calculated from your
              latitude
            </p>
          </section>
        )}

        <footer className="pd-section pd-foot">
          <p className="lp-body-sm">
            A plan and an estimate, not a guarantee. Only the {program.name} can approve a project. Rules checked{" "}
            {formatDate(program.verifiedAt)}, version {program.rulesVersion}: confirm the current rules on the program's page before
            you start. Some plants are toxic if eaten; check before planting near pets or children.
          </p>
          <p className="fl-source">nativo · grownativo.com</p>
        </footer>

        <section className="pd-email no-print" aria-labelledby="pd-email-title">
          <h2 id="pd-email-title" className="lp-h3">
            Email me this plan
          </h2>
          {sent?.ok ? (
            <p className="lp-body" role="status">
              Sent to {sent.email}. Check your inbox (and spam folder) in a minute or two.
            </p>
          ) : (
            <Form method="post" className="pd-email__form">
              <input type="hidden" name="area" value={area} />
              <label htmlFor="pd-email" className="fl-sr">
                Your email
              </label>
              <input
                id="pd-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="lp-address__input pd-email__input"
              />
              <button type="submit" className="lp-button lp-button--gold fl-button-link" disabled={sending}>
                {sending ? "Sending…" : "Send it"}
              </button>
            </Form>
          )}
          {sent && !sent.ok && (
            <p className="fl-error" role="alert">
              {sent.error}
            </p>
          )}
          <p className="fl-source">
            We send one email with a link to this plan. We do not save your email address or add you to any list. It
            passes through our email provider, Resend, to send this one message.
          </p>
        </section>
      </main>
    </div>
  );
}
