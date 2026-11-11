import { useEffect, useState } from "react";
import { Link, useFetcher, type ShouldRevalidateFunctionArgs } from "react-router";
import type { Route } from "./+types/plan";
import flowStyles from "../styles/flow.css?url";
import type { RebateCheck, RuleOutcome, RuleStage } from "@np/shared";
import { api } from "../lib/api.server";
import { shareImageMeta } from "../lib/meta";
import {
  PROGRAM_CODE,
  formatDate,
  formatDollars,
  formatNumber,
  placeFromParams,
  placeToParams,
  type ProgramResponse,
} from "../lib/flow";
import type { Plan } from "../lib/planner";
import { savePlanPlants, updateList } from "../lib/plant-list";
import { ZONE_LABELS, ZONE_TO_AREA, choiceFromParams, type YardChoice } from "../lib/yard";
import { FlowShell } from "../components/flow/Shell";
import { Planner, RESULT_LABELS } from "../components/flow/Planner";
import { Window } from "../components/landing/primitives";

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: flowStyles },
];

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Plan your rebate · nativo" },
    { name: "description", content: "Lay out a water-wise yard square by square and check it against Utah's Landscape Incentive Program rules as you go." },
    ...shareImageMeta,
  ];
}

/** Step 3: the plot planner. Works with or without an address; the ZIP only feeds the tracker. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  const place = placeFromParams(params);
  const yard = choiceFromParams(params);
  const result = await api<ProgramResponse>(context, `/v1/public/rebates/${PROGRAM_CODE}`);
  return {
    place,
    yard,
    data: result.ok ? result.data : null,
    error: result.ok ? null : result.error,
  };
}

/** A check changes nothing the loader reads, so skip reloading the program after one. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return formMethod === "POST" ? false : defaultShouldRevalidate;
}

interface CheckResponse {
  projectId: string | null;
  checkId: string | null;
  check: RebateCheck;
}

/** "Check my plan": the server checks again and records the result. */
export async function action({ request, context }: Route.ActionArgs) {
  const body = (await request.json().catch(() => null)) as { projectId?: string | null; zip?: string | null; layout?: unknown } | null;
  if (!body?.layout) return { ok: false as const, error: "That plan could not be read." };
  const result = await api<CheckResponse>(context, `/v1/public/rebates/${PROGRAM_CODE}/checks`, {
    method: "POST",
    body: { projectId: body.projectId ?? null, zip: body.zip ?? null, layout: body.layout },
  });
  return result.ok ? { ok: true as const, ...result.data } : { ok: false as const, error: result.error };
}

/** Where the plot's starting size came from, so the numbers can be traced back. */
function YardNote({ yard }: { yard: YardChoice }) {
  return (
    <aside className="lp-note lp-note--meadow fl-note fl-note--left fl-yard-note">
      <span className="lp-note__kicker">FROM YOUR YARD ESTIMATE</span>
      <p>
        Your {ZONE_LABELS[yard.zone].toLowerCase()} has about {formatNumber(yard.lawnSqft)} sq ft of lawn to replace. We started
        your plot at {yard.widthFt} × {yard.depthFt} ft ({formatNumber(yard.widthFt * yard.depthFt)} sq ft). Change the size to match
        your tape measure.
      </p>
    </aside>
  );
}

const STAGE_LABELS: Record<RuleStage, string> = {
  application: "When you apply",
  site_visit: "At the first site visit",
  completion: "When you finish",
  paperwork: "Before you are paid",
};

const PROJECT_KEY = "nativo.rebateProject";

function readProject(): string | null {
  try {
    return window.sessionStorage.getItem(PROJECT_KEY);
  } catch {
    return null;
  }
}
function saveProject(id: string) {
  try {
    window.sessionStorage.setItem(PROJECT_KEY, id);
  } catch {
    /* Private windows can refuse storage; the next check starts a new project. */
  }
}

export default function PlanPage({ loaderData }: Route.ComponentProps) {
  const { place, yard, data, error } = loaderData;
  const fetcher = useFetcher<typeof action>();
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [listSaved, setListSaved] = useState<"idle" | "saved" | "failed">("idle");

  const result = fetcher.data;
  useEffect(() => {
    if (result?.ok && result.projectId) {
      saveProject(result.projectId);
      setCheckedAt(new Date().toISOString());
      setListSaved("idle");
    }
  }, [result]);

  if (!data) {
    return (
      <FlowShell step={3}>
        <section className="fl-head">
          <h1 className="lp-h2">The planner is resting</h1>
          <p className="lp-lead">{error}</p>
          <div className="fl-actions">
            <a href={place ? `/plan?${placeToParams(place)}` : "/plan"} className="lp-button lp-button--green fl-button-link">
              Try again
            </a>
            <Link to="/rebates/utah" className="lp-button lp-button--paper fl-button-link">
              Read the rules meanwhile
            </Link>
          </div>
        </section>
      </FlowShell>
    );
  }

  const { program, plants } = data;
  const onCheck = (plan: Plan, _check: RebateCheck) => {
    fetcher.submit(
      { projectId: readProject(), zip: place?.zip ?? null, layout: plan } as never,
      { method: "post", encType: "application/json" },
    );
  };

  const recorded = result?.ok ? result.check : null;
  const otherRules = program.rules.filter((r) => r.checkType !== "plan_check");
  const byStage = (Object.keys(STAGE_LABELS) as RuleStage[])
    .map((stage) => ({ stage, rules: otherRules.filter((r) => r.stage === stage) }))
    .filter((g) => g.rules.length > 0);

  return (
    <FlowShell step={3}>
      <section className="fl-head" aria-labelledby="plan-title">
        <span className="lp-badge lp-badge--sky">Step 3 · Plan and rebate</span>
        <h1 id="plan-title" className="lp-h2">
          Swap the grass, <span className="lp-accent">square by square</span>
        </h1>
        <p className="lp-lead">
          Pick an area, set its size, then plant it. We check your layout against the {program.name} as you go.
        </p>
        {place ? (
          <p className="fl-head__address np-value">
            {place.address}
          </p>
        ) : null}
        {place ? (
          <Link to={`/report?${placeToParams(place)}`} className="lp-button lp-button--paper fl-button-link fl-button-link--sm">
            Back to your ground
          </Link>
        ) : (
          <p className="lp-body-sm">
            Planning without an address. <Link to="/">Start with your address</Link> to see your soil and climate too.
          </p>
        )}
      </section>

      {yard && <YardNote yard={yard} />}

      <Planner
        program={program}
        plants={plants}
        onCheck={onCheck}
        checking={fetcher.state !== "idle"}
        initial={yard ? { areaKind: ZONE_TO_AREA[yard.zone], widthFt: yard.widthFt, depthFt: yard.depthFt } : null}
      />

      {result && !result.ok && (
        <p className="fl-error" role="alert">
          {result.error}
        </p>
      )}

      {recorded && (
        <section className="fl-result" aria-labelledby="result-title" aria-live="polite">
          <Window label={`plan-check · rules ${program.rulesVersion}`} tone={recorded.overall === "likely" ? "green" : "paper"} size="md">
            <h2 id="result-title" className="lp-h3">
              {recorded.overall === "likely"
                ? "Your plan meets every rule we can check"
                : "A few things to change before you apply"}
            </h2>
            {yard && (
              <p className="lp-body">
                For your {ZONE_LABELS[yard.zone].toLowerCase()}: about {formatNumber(yard.lawnSqft)} sq ft of lawn to replace, out of{" "}
                {formatNumber(yard.zoneSqft)} sq ft of open ground (our estimate).
                {recorded.eligibleSqft < yard.lawnSqft * 0.8
                  ? ` This plan covers ${formatNumber(recorded.eligibleSqft)} sq ft of it: plan the rest as another area, or make this one bigger.`
                  : ""}
              </p>
            )}
            <p className="lp-body">
              {formatNumber(recorded.eligibleSqft)} sq ft that counts · about {Math.round(recorded.coveragePct)}% plant cover
              when grown · an estimated {formatDollars(recorded.estimatedAmount)}.
            </p>
            {recorded.plants.length > 0 && (
              <div className="fl-shopping">
                <h3 className="lp-h3-card">Your plant list</h3>
                <ul className="fl-list">
                  {recorded.plants.map((p) => (
                    <li key={p.plantId}>
                      <span className="np-value">{p.plantCount}</span> {p.commonName}{" "}
                      <span className="fl-muted">({p.squares} square{p.squares === 1 ? "" : "s"})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {recorded.plants.length > 0 && (
              <div className="fl-actions">
                {listSaved === "saved" ? (
                  <Link to="/list" className="lp-button lp-button--gold fl-button-link">
                    Saved · open my list
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="lp-button lp-button--gold fl-button-link"
                    onClick={() => {
                      const byId = new Map(plants.map((p) => [p.id, p]));
                      const items = recorded.plants.flatMap((t) => {
                        const plant = byId.get(t.plantId);
                        return plant ? [{ plant, count: t.plantCount }] : [];
                      });
                      setListSaved(updateList((l) => savePlanPlants(l, items)) ? "saved" : "failed");
                    }}
                  >
                    Save these plants to my list
                  </button>
                )}
                <button type="button" className="lp-button lp-button--paper fl-button-link" onClick={() => window.print()}>
                  Print this plan
                </button>
              </div>
            )}
            {listSaved === "failed" && (
              <p className="fl-error" role="alert">
                Your browser would not save the list. Private windows sometimes block saving. You can still print this plan.
              </p>
            )}
            <p className="fl-source">
              Checked {checkedAt ? formatDate(checkedAt) : "just now"} against rules version {program.rulesVersion}.
              Only the program can approve a project.
            </p>
          </Window>
          <aside className="lp-note lp-note--peach fl-note fl-note--right">
            <span className="lp-note__kicker">COMING NEXT</span>
            <p>Soon you can send this plan to your inbox, with the plant list, the checklist and the program's deadlines. For now, save it to your list or print it.</p>
          </aside>
        </section>
      )}

      <section className="fl-rest" aria-labelledby="rest-title">
        <h2 id="rest-title" className="lp-h2">
          Everything else the program asks
        </h2>
        <p className="lp-body-lg fl-rest__intro">
          These rules need you, or the program's inspector, to confirm them. Tap any rule to read the program's own
          words.
        </p>
        <div className="fl-stages">
          {byStage.map(({ stage, rules }) => (
            <Window key={stage} label={STAGE_LABELS[stage].toLowerCase()} tone="paper" className="fl-stage">
              <ul className="fl-rules">
                {rules.map((r) => {
                  const result: RuleOutcome["result"] = r.checkType === "inspector_only" ? "inspector_checks" : "owner_to_confirm";
                  return (
                    <li key={r.code} className={`fl-rule fl-rule--${result}`}>
                      <span className="fl-rule__mark" aria-hidden="true" />
                      <details className="fl-rule__text">
                        <summary className="fl-rule__title">{r.title}</summary>
                        <span className="fl-rule__note">{r.plainText}</span>
                        <blockquote className="fl-rule__source">
                          “{r.sourceText}” <span className="np-value">({r.code})</span>
                        </blockquote>
                      </details>
                      <span className="fl-rule__result">{RESULT_LABELS[result]}</span>
                    </li>
                  );
                })}
              </ul>
            </Window>
          ))}
        </div>
        <p className="fl-source">
          {program.name} · {program.utilityName} · rules checked {formatDate(program.verifiedAt)}
          {program.amountNote ? ` · ${program.amountNote}` : ""}
        </p>
        <a
          href={program.sourceUrl}
          rel="noopener noreferrer"
          className="lp-button lp-button--paper fl-button-link fl-button-link--sm fl-self-start"
        >
          Read the program's page
        </a>
      </section>
    </FlowShell>
  );
}
