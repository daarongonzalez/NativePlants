import { useState } from "react";
import type { YardEstimate, YardZone, YardZoneKind } from "@np/shared";
import { formatDate, formatNumber } from "../../lib/flow";
import { ZONE_LABELS, cellRuns, defaultLawn, plannerStart, type YardChoice } from "../../lib/yard";
import { Stat, Window } from "../landing/primitives";

/**
 * The aerial photo of the lot, with what we measured drawn over it: the lot
 * line, the buildings, the street side, and (switchable) which ground we
 * counted as planted or bare. Drawn in metres, so it scales to any screen.
 */
export function YardDrawing({ estimate, showCounted }: { estimate: YardEstimate; showCounted: boolean }) {
  const { drawing, photo } = estimate;
  const { widthM, heightM, cells } = drawing;
  const cw = widthM / cells.columns;
  const ch = heightM / cells.rows;
  const [photoFailed, setPhotoFailed] = useState(false);
  const pts = (ring: [number, number][]) => ring.map(([x, y]) => `${x},${y}`).join(" ");
  const street = drawing.street;
  const mid = street ? [(street[0][0] + street[1][0]) / 2, (street[0][1] + street[1][1]) / 2] : null;
  const stroke = Math.max(widthM, heightM) / 160;

  return (
    <figure className="yd-figure">
      <svg
        viewBox={`0 0 ${widthM} ${heightM}`}
        className="yd-svg"
        role="img"
        aria-label={`Aerial photo of the lot with its outline, ${formatNumber(estimate.parcel.lotSqft)} square feet`}
      >
        <rect width={widthM} height={heightM} className="yd-ground" />
        {!photoFailed && (
          <image
            href={photo.url}
            width={widthM}
            height={heightM}
            preserveAspectRatio="none"
            onError={() => setPhotoFailed(true)}
          />
        )}
        {showCounted &&
          (["p", "b"] as const).map((code) => (
            <g key={code} className={`yd-cells yd-cells--${code}`} shapeRendering="crispEdges">
              {cellRuns(cells, code).map((run) => (
                <rect key={`${run.row}-${run.col}`} x={run.col * cw} y={run.row * ch} width={run.length * cw} height={ch} />
              ))}
            </g>
          ))}
        {drawing.buildings.map((b, i) => (
          <polygon key={i} points={pts(b)} className="yd-building" strokeWidth={stroke} />
        ))}
        <polygon points={pts(drawing.lot)} className="yd-lot" strokeWidth={stroke * 1.5} />
        {street && (
          <line
            x1={street[0][0]}
            y1={street[0][1]}
            x2={street[1][0]}
            y2={street[1][1]}
            className="yd-street"
            strokeWidth={stroke * 3}
          />
        )}
        {mid && (
          <text x={mid[0]} y={mid[1]} className="yd-street-label" fontSize={stroke * 5.5} dy={stroke * -2.5} textAnchor="middle">
            street
          </text>
        )}
      </svg>
      <figcaption className="fl-source">
        {photo.read ? "Aerial photo" : "Lot outline (the aerial photo did not load)"} · {photo.source}
        {photo.takenOn ? `, taken ${formatDate(photo.takenOn)}` : ""} · {photo.metresPerPixel} m a pixel · lot line from{" "}
        {estimate.parcel.county} records{estimate.parcel.recordsAsOf ? `, ${formatDate(estimate.parcel.recordsAsOf)}` : ""} ·
        building outlines from Microsoft via UGRC
      </figcaption>
    </figure>
  );
}

/**
 * Your yard: the estimate, then a choice of which part to plan and how much
 * of it is lawn. The choice starts the planner at about the right size.
 */
export function YardPanel({
  estimate,
  initialZone,
  onChoose,
}: {
  estimate: YardEstimate;
  initialZone: YardZoneKind | null;
  onChoose: (choice: YardChoice | null) => void;
}) {
  const [showCounted, setShowCounted] = useState(estimate.photo.read);
  const [zoneKind, setZoneKind] = useState<YardZoneKind | null>(initialZone);
  const [lawn, setLawn] = useState<Record<string, number>>(() =>
    Object.fromEntries(estimate.zones.map((z) => [z.kind, defaultLawn(z)])),
  );
  const zone = estimate.zones.find((z) => z.kind === zoneKind) ?? null;

  const choose = (z: YardZone | null, lawnSqft?: number) => {
    if (!z) return onChoose(null);
    const l = Math.max(0, Math.min(z.areaSqft, lawnSqft ?? lawn[z.kind] ?? defaultLawn(z)));
    onChoose({ zone: z.kind, zoneSqft: z.areaSqft, lawnSqft: l, ...plannerStart(l, z) });
  };
  const pick = (z: YardZone) => {
    setZoneKind(z.kind);
    choose(z);
  };
  const setZoneLawn = (z: YardZone, value: number) => {
    const v = Math.max(0, Math.min(z.areaSqft, Math.round(value / 10) * 10));
    setLawn((all) => ({ ...all, [z.kind]: v }));
    if (z.kind === zoneKind) choose(z, v);
  };

  const e = estimate;
  return (
    <Window label="your-yard · estimate" number={4} tone="paper" size="lg" className="fl-report__yard yd">
      <div className="yd-grid">
        <div className="yd-photo">
          <YardDrawing estimate={e} showCounted={showCounted} />
          {e.photo.read && (
            <label className="yd-toggle">
              <input type="checkbox" checked={showCounted} onChange={(ev) => setShowCounted(ev.target.checked)} />
              <span>Show what we counted</span>
              <span className="yd-key yd-key--p" aria-hidden="true" /> planted
              <span className="yd-key yd-key--b" aria-hidden="true" /> bare
            </label>
          )}
        </div>

        <div className="yd-facts">
          <div className="yd-stats">
            <Stat label="Lot" value={`${formatNumber(e.parcel.lotSqft)} sq ft`} source="County lot line" small />
            <Stat label="House and buildings" value={`${formatNumber(e.buildingSqft)} sq ft`} source="Outline on the photo" small />
            <Stat
              label="Planted now"
              value={e.plantedSqft === null ? "Not read" : `${formatNumber(e.plantedSqft)} sq ft`}
              source="Lawn, trees and beds"
              small
            />
            <Stat
              label="Bare or paved"
              value={e.bareSqft === null ? "Not read" : `${formatNumber(e.bareSqft)} sq ft`}
              source="Driveway, paths, patio"
              small
            />
          </div>
          {e.parcel.recordedBuildingSqft !== null && (
            <p className="fl-source">
              County records: {formatNumber(e.parcel.recordedBuildingSqft)} sq ft of floor space
              {e.parcel.floors ? ` on ${e.parcel.floors} floor${e.parcel.floors === 1 ? "" : "s"}` : ""}
              {e.parcel.builtYear ? `, built ${e.parcel.builtYear}` : ""}.
              {e.parcel.matchedBy === "address" ? " Matched to your address." : " The nearest lot to your address."}
            </p>
          )}

          <fieldset className="yd-zones">
            <legend className="lp-h3-card">Which part will you plan first?</legend>
            {e.zones.map((z) => {
              const on = z.kind === zoneKind;
              const value = lawn[z.kind] ?? defaultLawn(z);
              return (
                <div key={z.kind} className={`yd-zone${on ? " yd-zone--on" : ""}`}>
                  <button type="button" className="yd-zone__pick" aria-pressed={on} onClick={() => pick(z)}>
                    <span className="yd-zone__name">{ZONE_LABELS[z.kind]}</span>
                    <span className="yd-zone__figures np-value">
                      {formatNumber(z.areaSqft)} sq ft open
                      {z.plantedSqft !== null ? ` · ${formatNumber(z.plantedSqft)} planted` : ""} · about {z.widthFt} × {z.depthFt} ft
                    </span>
                  </button>
                  {on && (
                    <div className="yd-lawn">
                      <label htmlFor={`lawn-${z.kind}`} className="yd-lawn__label">
                        Lawn you would replace here
                      </label>
                      <div className="yd-lawn__row">
                        <button
                          type="button"
                          className="lp-button lp-button--paper fl-size__step"
                          aria-label="100 sq ft less"
                          onClick={() => setZoneLawn(z, value - 100)}
                        >
                          −
                        </button>
                        <input
                          id={`lawn-${z.kind}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={z.areaSqft}
                          step={10}
                          value={value}
                          onChange={(ev) => setZoneLawn(z, Number(ev.target.value))}
                          className="yd-lawn__input np-value"
                        />
                        <span className="yd-lawn__unit">sq ft</span>
                        <button
                          type="button"
                          className="lp-button lp-button--paper fl-size__step"
                          aria-label="100 sq ft more"
                          onClick={() => setZoneLawn(z, value + 100)}
                        >
                          +
                        </button>
                      </div>
                      <p className="yd-lawn__help">
                        We started from the planted ground the photo shows. Take off beds and trees you will keep, and add
                        lawn the photo missed.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </fieldset>
        </div>
      </div>

      {e.caveats.length > 0 && (
        <ul className="fl-list yd-caveats">
          {e.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      <p className="fl-source">
        An estimate from public records and an aerial photo, not a survey. The rebate program measures your area at its
        first site visit.
      </p>
    </Window>
  );
}
