import { Form } from "react-router";
import { SUN_QUESTION, type SunExposure } from "@np/shared";
import { formatMonthDay, trackPosition, type ProfileResponse } from "../../lib/flow";

type Soil = NonNullable<ProfileResponse["detail"]["soil"]>;
type Frost = NonNullable<ProfileResponse["detail"]["frostStation"]>;

/** How deep the column draws. Most gardening happens in the top 30 cm. */
const COLUMN_DEPTH_CM = 150;

/**
 * Soil layers drawn to scale, dark at the surface to pale at depth. The thin
 * top layer looks thin: that is the point.
 */
export function SoilColumn({ soil }: { soil: Soil }) {
  const layers = soil.horizons.filter((h) => h.depthTopCm < COLUMN_DEPTH_CM);
  if (layers.length === 0) return null;
  return (
    <figure className="fl-soil">
      <div className="fl-soil__column" role="img" aria-label={`Soil layers to ${COLUMN_DEPTH_CM} cm deep`}>
        {layers.map((h, i) => {
          const bottom = Math.min(h.depthBottomCm, COLUMN_DEPTH_CM);
          const share = ((bottom - h.depthTopCm) / COLUMN_DEPTH_CM) * 100;
          return (
            <div
              key={h.depthTopCm}
              className="fl-soil__layer"
              style={{ flexBasis: `${share}%`, background: `var(--np-horizon-${Math.min(i, 5)})` }}
            />
          );
        })}
      </div>
      <ol className="fl-soil__legend">
        {layers.map((h) => (
          <li key={h.depthTopCm}>
            <span className="np-value">
              {h.depthTopCm}–{Math.min(h.depthBottomCm, COLUMN_DEPTH_CM)} cm
            </span>
            <span className="np-value">
              {h.ph !== null ? `pH ${h.ph.toFixed(1)}` : "pH not measured"}
              {h.clayPct !== null ? ` · ${Math.round(h.clayPct)}% clay` : ""}
            </span>
          </li>
        ))}
      </ol>
      <figcaption className="fl-source">
        {soil.name} · USDA county soil survey ({soil.surveyArea}). An average for the surrounding map area, not a
        sample from your yard.
      </figcaption>
    </figure>
  );
}

function Track({
  label,
  from,
  to,
  marks,
  ends,
}: {
  label: string;
  from: string;
  to: string;
  marks: { md: string; pct: string; text: string }[];
  ends: [string, string];
}) {
  return (
    <div className="fl-track">
      <span className="fl-track__label">{label}</span>
      <div className="fl-track__rail">
        {marks.map((m) => (
          <span key={m.pct} className="fl-track__mark" style={{ left: `${trackPosition(m.md, from, to)}%` }}>
            <span className="fl-track__dot" aria-hidden="true" />
            <span className="fl-track__text np-value">
              {formatMonthDay(m.md)}
              <span className="fl-track__pct">{m.pct}</span>
            </span>
          </span>
        ))}
      </div>
      <div className="fl-track__ends np-value" aria-hidden="true">
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </div>
      <p className="fl-sr">
        {marks.map((m) => `${m.text}: ${formatMonthDay(m.md)}.`).join(" ")}
      </p>
    </div>
  );
}

/**
 * Frost as odds, not a single date. Planting on 9 April is a different bet
 * from planting on 8 May, and the tracks make that visible.
 */
export function FrostBand({ frost }: { frost: Frost }) {
  return (
    <div className="fl-frost">
      <Track
        label="Last spring frost"
        from="03-15"
        to="06-15"
        ends={["Mid Mar", "Mid Jun"]}
        marks={[
          { md: frost.lastSpringP90, pct: "90%", text: "9 years in 10 the last frost is after" },
          { md: frost.lastSpringP50, pct: "50%", text: "Half of years the last frost is after" },
          { md: frost.lastSpringP10, pct: "10%", text: "1 year in 10 the last frost is after" },
        ]}
      />
      <Track
        label="First fall frost"
        from="09-01"
        to="11-15"
        ends={["Sep", "Mid Nov"]}
        marks={[
          { md: frost.firstFallP10, pct: "10%", text: "1 year in 10 the first frost is before" },
          { md: frost.firstFallP50, pct: "50%", text: "Half of years the first frost is before" },
          { md: frost.firstFallP90, pct: "90%", text: "9 years in 10 the first frost is before" },
        ]}
      />
      <p className="fl-frost__read">
        The percentages are the chance of frost on or after that spring date, or on or before that fall date. Plant
        tender things after the <b>10%</b> spring date if you would rather not gamble.
      </p>
    </div>
  );
}

/** One question, three answers and a way out. Answering reloads the report with the sun you see. */
export function SunQuestion({ current, hidden }: { current: SunExposure | null; hidden: Record<string, string> }) {
  return (
    <Form method="get" className="fl-sun" preventScrollReset>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <fieldset className="fl-sun__set">
        <legend className="fl-sun__prompt">{SUN_QUESTION.prompt}</legend>
        <p className="fl-sun__help">{SUN_QUESTION.help}</p>
        <div className="fl-sun__options">
          {SUN_QUESTION.options.map((o) => (
            <button
              key={o.value}
              type="submit"
              name="sun"
              value={o.value}
              className={`fl-option${current === o.value ? " fl-option--on" : ""}`}
              aria-pressed={current === o.value}
            >
              <span className="fl-option__label">{o.label}</span>
              <span className="fl-option__detail">{o.detail}</span>
            </button>
          ))}
          <button
            type="submit"
            name="sun"
            value=""
            className={`fl-option fl-option--skip${current === null ? " fl-option--on" : ""}`}
            aria-pressed={current === null}
          >
            <span className="fl-option__label">{SUN_QUESTION.skip}</span>
            <span className="fl-option__detail">{SUN_QUESTION.skipNote}</span>
          </button>
        </div>
      </fieldset>
    </Form>
  );
}

