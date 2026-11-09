import { useMemo, useState } from "react";
import { Link } from "react-router";
import { checkPlan, narrowLawnSquares, plantsPerSquare } from "@np/engine";
import {
  AREA_KIND_LABELS,
  SQUARE_FT,
  SQUARE_SQFT,
  type AreaKind,
  type PlanPlant,
  type RebateCheck,
  type RebateProgramSummary,
  type RuleOutcome,
} from "@np/shared";
import { formatDollars, formatNumber, inches } from "../../lib/flow";
import {
  canGrow,
  fillLawn,
  newPlan,
  paint,
  plantColor,
  resize,
  sageLine,
  shortName,
  type Brush,
  type Plan,
} from "../../lib/planner";
import { addPlant, updateList, useSavedList } from "../../lib/plant-list";
import { Flower, Stat, Window } from "../landing/primitives";

const FORM_FILTERS = [
  { value: "all", label: "All" },
  { value: "low", label: "Under 24 in" },
  { value: "wildflower", label: "Wildflowers" },
  { value: "groundcover", label: "Groundcovers" },
  { value: "grass", label: "Grasses" },
  { value: "shrub", label: "Shrubs" },
  { value: "tree", label: "Trees" },
] as const;

type Filter = (typeof FORM_FILTERS)[number]["value"];

const MATERIALS: { brush: Brush; label: string; detail: string }[] = [
  { brush: { kind: "mulch" }, label: "Mulch", detail: "Bark, gravel or flagstone chips, 3 to 4 inches deep. Counts towards the area, not the plant cover." },
  { brush: { kind: "pavers" }, label: "Pavers", detail: "Concrete, pavers and other solid hardscape. Allowed, but not paid for." },
  { brush: { kind: "lawn" }, label: "Keep lawn", detail: "Leave grass here. Any lawn you keep must be at least 8 ft wide." },
];

export const RESULT_LABELS: Record<RuleOutcome["result"], string> = {
  pass: "Looks good",
  warn: "Check this",
  fail: "Needs a change",
  not_applicable: "Does not apply",
  owner_to_confirm: "You confirm",
  inspector_checks: "Inspector checks",
};

/**
 * The plot planner: the game at the centre of the flow.
 *
 * Every tap re-runs the same rebate check the API runs, so the numbers and
 * Sage's advice move as you plant. "Check my plan" sends the layout to the
 * server, which checks it again and records it for the tracker.
 */
export function Planner({
  program,
  plants,
  onCheck,
  checking,
}: {
  program: RebateProgramSummary;
  plants: PlanPlant[];
  onCheck: (plan: Plan, check: RebateCheck) => void;
  checking: boolean;
}) {
  const [plan, setPlan] = useState<Plan>(() => newPlan("front"));
  const [brush, setBrush] = useState<Brush>(() =>
    plants[0] ? { kind: "plant", plantId: plants[0].id } : { kind: "mulch" },
  );
  const [filter, setFilter] = useState<Filter>("all");
  const { list: saved } = useSavedList();
  const savedIds = useMemo(() => new Set(saved.map((p) => p.id)), [saved]);

  const byId = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);
  const check = useMemo(() => checkPlan(program, plan, plants), [program, plan, plants]);
  const columns = plan.widthFt / SQUARE_FT;
  const narrow = useMemo(() => {
    const failing = check.outcomes.find((o) => o.code === "C1")?.result === "fail";
    return failing ? new Set(narrowLawnSquares(plan.cells, columns, 8)) : new Set<number>();
  }, [check, plan.cells, columns]);

  const shown = plants.filter((p) =>
    filter === "all" ? true : filter === "low" ? p.staysUnder24In === true : p.plantForm === filter,
  );
  const selectedPlant = brush.kind === "plant" ? byId.get(brush.plantId) : undefined;
  const hasDrafts = plants.some((p) => p.reviewStatus !== "published");
  const planChecks = check.outcomes.filter((o) => o.checkType === "plan_check");

  const setKind = (kind: AreaKind) => setPlan((p) => (p.areaKind === kind ? p : { ...newPlan(kind) }));
  const step = (side: "width" | "depth", by: number) =>
    setPlan((p) =>
      side === "width" ? resize(p, p.widthFt + by, p.depthFt) : resize(p, p.widthFt, p.depthFt + by),
    );

  const isOn = (b: Brush) =>
    b.kind === brush.kind && (b.kind !== "plant" || (brush.kind === "plant" && b.plantId === brush.plantId));

  return (
    <div className="fl-planner">
      <Window label={`plot-planner · ${AREA_KIND_LABELS[plan.areaKind].toLowerCase()}`} tone="paper" size="lg" dots className="lp-planner fl-planner__board">
        <div className="fl-area" role="radiogroup" aria-label="Which area are you planning?">
          {(Object.keys(AREA_KIND_LABELS) as AreaKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={plan.areaKind === kind}
              className={`fl-chip-button${plan.areaKind === kind ? " fl-chip-button--on" : ""}`}
              onClick={() => setKind(kind)}
            >
              {AREA_KIND_LABELS[kind]}
            </button>
          ))}
        </div>

        <div className="fl-size">
          {(["width", "depth"] as const).map((side) => {
            const ft = side === "width" ? plan.widthFt : plan.depthFt;
            return (
              <div key={side} className="fl-size__row">
                <span className="fl-size__label">{side === "width" ? "Width" : "Depth"}</span>
                <button
                  type="button"
                  className="lp-button lp-button--paper fl-size__step"
                  aria-label={`${side === "width" ? "Narrower" : "Shallower"} by 5 ft`}
                  disabled={ft <= SQUARE_FT}
                  onClick={() => step(side, -SQUARE_FT)}
                >
                  −
                </button>
                <span className="np-value fl-size__value">{ft} ft</span>
                <button
                  type="button"
                  className="lp-button lp-button--paper fl-size__step"
                  aria-label={`${side === "width" ? "Wider" : "Deeper"} by 5 ft`}
                  disabled={!canGrow(plan, side)}
                  onClick={() => step(side, SQUARE_FT)}
                >
                  +
                </button>
              </div>
            );
          })}
          <span className="fl-size__total np-value">
            {formatNumber(plan.cells.length * SQUARE_SQFT)} sq ft · {plan.cells.length} squares
          </span>
        </div>

        <div className="fl-plot-scroll">
          <div
            className="lp-plot fl-plot"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(var(--np-touch-min), 1fr))` }}
            role="group"
            aria-label={`Your ${AREA_KIND_LABELS[plan.areaKind].toLowerCase()}, ${plan.widthFt} by ${plan.depthFt} ft, in 5 ft squares`}
          >
            {plan.cells.map((cell, i) => {
              const plant = cell.kind === "plant" ? byId.get(cell.plantId) : undefined;
              const dark = (Math.floor(i / columns) + (i % columns)) % 2 === 1;
              const cls =
                cell.kind === "lawn"
                  ? `lp-tile${dark ? " lp-tile--dark-d fl-tile--dark" : ""}${narrow.has(i) ? " fl-tile--narrow" : ""}`
                  : cell.kind === "mulch"
                    ? "lp-tile lp-tile--planted fl-tile--mulch"
                    : cell.kind === "pavers"
                      ? "lp-tile fl-tile--pavers"
                      : "lp-tile lp-tile--planted";
              const label =
                cell.kind === "lawn"
                  ? `Lawn${narrow.has(i) ? ", in a strip under 8 ft" : ""}`
                  : cell.kind === "plant"
                    ? (plant?.commonName ?? "Plant")
                    : cell.kind === "mulch"
                      ? "Mulch"
                      : "Pavers";
              return (
                <button key={i} type="button" className={cls} aria-label={label} onClick={() => setPlan((p) => paint(p, i, brush))}>
                  {plant && (
                    <span className="fl-tile__plant">
                      <Flower token={plantColor(plant)} />
                      <span className="fl-tile__tag">{shortName(plant.commonName)}</span>
                    </span>
                  )}
                  {cell.kind === "pavers" && <span className="fl-paver" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="fl-palette">
          <div className="fl-materials" role="radiogroup" aria-label="Materials">
            {MATERIALS.map((m) => (
              <button
                key={m.label}
                type="button"
                role="radio"
                aria-checked={isOn(m.brush)}
                className={`fl-material fl-material--${m.brush.kind}${isOn(m.brush) ? " fl-material--on" : ""}`}
                onClick={() => setBrush(m.brush)}
              >
                <span className="fl-material__swatch" aria-hidden="true" />
                {m.label}
              </button>
            ))}
            <button type="button" className="lp-button lp-button--paper fl-fill" onClick={() => setPlan((p) => fillLawn(p, brush))}>
              Fill the lawn
            </button>
            <button type="button" className="lp-button lp-button--paper fl-fill" onClick={() => setPlan((p) => newPlan(p.areaKind))}>
              Start over
            </button>
          </div>

          {plants.length > 0 ? (
            <>
              <div className="fl-filters" role="group" aria-label="Filter plants">
                {FORM_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={filter === f.value}
                    className={`fl-chip-button fl-chip-button--sm${filter === f.value ? " fl-chip-button--on" : ""}`}
                    onClick={() => setFilter(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="fl-seeds" role="radiogroup" aria-label="Plants">
                {shown.map((p) => {
                  const b: Brush = { kind: "plant", plantId: p.id };
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={isOn(b)}
                      title={p.commonName}
                      className={`lp-seed fl-seed${isOn(b) ? " lp-seed--on" : ""}`}
                      onClick={() => setBrush(b)}
                    >
                      <Flower token={plantColor(p)} stem={false} />
                      <span className="lp-seed__short">{shortName(p.commonName)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="lp-body-sm">No plants are ready yet. You can still lay out mulch and pavers.</p>
          )}

          <div className="fl-chosen" aria-live="polite">
            {selectedPlant ? (
              <>
                <span className="lp-planner__common">{selectedPlant.commonName}</span>
                <span className="np-sci-name lp-planner__sci">{selectedPlant.scientificName}</span>
                <span className="fl-chosen__facts np-value">
                  {inches(selectedPlant.matureHeightCm)} in tall · {inches(selectedPlant.matureWidthCm)} in wide when grown ·{" "}
                  {plantsPerSquare(selectedPlant.matureWidthCm)} per square
                </span>
                <span className="fl-chosen__tags">
                  {selectedPlant.plantForm === "tree" && <span className="lp-chip">Canopy does not count</span>}
                  {selectedPlant.staysUnder24In === true && <span className="lp-chip">Park strip safe</span>}
                  {selectedPlant.reviewStatus !== "published" && <span className="lp-chip fl-chip--draft">Draft data</span>}
                </span>
                {savedIds.has(selectedPlant.id) ? (
                  <Link to="/list" className="lp-button lp-button--paper fl-save fl-save--on">
                    On your list · view it
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="lp-button lp-button--gold fl-save"
                    onClick={() => updateList((l) => addPlant(l, selectedPlant))}
                  >
                    Save to my list
                  </button>
                )}
              </>
            ) : (
              <span className="lp-body-sm">{MATERIALS.find((m) => isOn(m.brush))?.detail}</span>
            )}
          </div>
        </div>

        <p className="lp-footnote fl-footnote">
          Each square is 5 by 5 ft · plants spaced at their grown width
          {hasDrafts ? " · plant details are drafts awaiting expert review" : ""}
        </p>
      </Window>

      <Window label="rebate-check · live" tone="gold" size="md" className="fl-planner__check">
        <div className="lp-sage">
          <div className="lp-sage__avatar" aria-hidden="true">
            Sage
          </div>
          <div className="lp-sage__bubble">
            <span className="lp-sage__name">Sage</span>
            <p aria-live="polite">{sageLine(check, program.minAreaSqft, program.minPlantCoveragePct)}</p>
          </div>
        </div>

        <div className="fl-check-stats">
          <Stat label="Area that counts" value={`${formatNumber(check.eligibleSqft)} sq ft`} small />
          <Stat label="Plant cover, grown" value={`${Math.round(check.coveragePct)}%`} small />
          <Stat
            small
            label="Estimated rebate"
            value={formatDollars(check.estimatedAmount)}
            source={program.perSqftAmount !== null ? `${formatDollars(program.perSqftAmount)} a sq ft` : undefined}
          />
        </div>

        <ul className="fl-rules fl-rules--live" aria-label="Rules we can check from your plan">
          {planChecks.map((o) => (
            <li key={o.code} className={`fl-rule fl-rule--${o.result}`}>
              <span className="fl-rule__mark" aria-hidden="true" />
              <span className="fl-rule__text">
                <span className="fl-rule__title">{o.title}</span>
                <span className="fl-rule__note">{o.note}</span>
              </span>
              <span className="fl-rule__result">{RESULT_LABELS[o.result]}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="lp-button lp-button--green fl-check-button"
          disabled={checking || check.eligibleSqft === 0}
          onClick={() => onCheck(plan, check)}
        >
          {checking ? "Checking…" : "Check my plan"}
        </button>
        <p className="fl-source">
          Estimate only. Every figure comes from 5 ft squares and plants' grown sizes. Only the program can approve a
          project.
        </p>
      </Window>
    </div>
  );
}

