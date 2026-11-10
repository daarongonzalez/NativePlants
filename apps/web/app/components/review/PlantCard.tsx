import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ReviewPlant } from "@np/shared";
import type { GardenSprite } from "../../content/garden-sprites";
import { formatDate } from "../../lib/flow";
import {
  STATE_LABELS,
  choosePhoto,
  factGroups,
  gameTextMismatches,
  photoGaps,
  reviewState,
  type PhotoChoice,
} from "../../lib/review";
import { Window } from "../landing/primitives";

export interface Draft {
  notes: string;
  spriteCheck: "ok" | "problem" | "none" | null;
  photos: PhotoChoice[];
}

/** How far a swipe must travel to count, in CSS pixels. */
const SWIPE_DISTANCE = 120;

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
const isControl = (el: EventTarget | null) =>
  el instanceof HTMLElement && el.closest("button, a, input, textarea, select, label, summary") !== null;

/**
 * One plant: the facts in plain words, the photo candidates, the garden
 * game's drawing, notes, and the decision.
 */
export function PlantCard({
  plant,
  sprite,
  draft,
  onDraft,
  onDecide,
  onSkip,
  saving,
  canSkip,
}: {
  plant: ReviewPlant;
  sprite: { sprite: GardenSprite; exact: boolean } | null;
  draft: Draft;
  onDraft: (d: Draft) => void;
  onDecide: (decision: "pass" | "fail") => string | null;
  onSkip: () => void;
  saving: boolean;
  canSkip: boolean;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const state = reviewState(plant);
  const gaps = photoGaps(draft.photos, plant.photos.length);
  const mismatches = sprite?.exact ? gameTextMismatches(sprite.sprite.gameText, plant) : [];

  const decide = (decision: "pass" | "fail") => {
    const why = onDecide(decision);
    setProblem(why);
    if (why && decision === "fail") notesRef.current?.focus();
  };

  // A for approve, F for fail, S to skip: not while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "a") decide("pass");
      else if (k === "f") decide("fail");
      else if (k === "s" && canSkip) onSkip();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Swipe right to approve, left to fail. Starts only on the card, not on a control.
  const onPointerDown = (e: ReactPointerEvent) => {
    if (isControl(e.target) || e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const moveX = e.clientX - d.x;
    // A mostly vertical move is a scroll, not a swipe.
    if (Math.abs(e.clientY - d.y) > Math.abs(moveX) && Math.abs(moveX) < 24) return;
    setDx(moveX);
  };
  const onPointerEnd = () => {
    if (!drag.current) return;
    drag.current = null;
    const moved = dx;
    setDx(0);
    if (moved > SWIPE_DISTANCE) decide("pass");
    else if (moved < -SWIPE_DISTANCE) decide("fail");
  };

  const swipeHint = dx > SWIPE_DISTANCE / 2 ? "pass" : dx < -SWIPE_DISTANCE / 2 ? "fail" : null;
  const common = plant.commonNames[0] ?? plant.scientificName;

  return (
    <div
      className={`rv-card${swipeHint ? ` rv-card--${swipeHint}` : ""}`}
      style={dx ? { transform: `translateX(${dx}px) rotate(${dx / 60}deg)` } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      {swipeHint && (
        <span className={`rv-swipe rv-swipe--${swipeHint}`} aria-hidden="true">
          {swipeHint === "pass" ? "Approve" : "Fail"}
        </span>
      )}

      <Window label={`plant · ${plant.scientificName.toLowerCase()}`} tone="paper" size="lg" className="rv-plant">
        <div className="rv-plant__head">
          <div className="rv-plant__names">
            <h2 className="lp-h3">{common}</h2>
            <span className="np-sci-name rv-plant__sci">{plant.scientificName}</span>
            {plant.commonNames.length > 1 && <span className="rv-plant__aka">Also: {plant.commonNames.slice(1).join(", ")}</span>}
          </div>
          <span className={`rv-state rv-state--${state}`}>{STATE_LABELS[state]}</span>
        </div>

        {plant.lastReview && (
          <p className={`rv-last${plant.lastReview.factsChangedSince ? " rv-last--changed" : ""}`}>
            {plant.lastReview.decision === "pass" ? "Passed" : "Failed"} by {plant.lastReview.reviewerEmail} on{" "}
            {formatDate(plant.lastReview.createdAt)}
            {plant.lastReview.notes ? `: “${plant.lastReview.notes}”` : "."}
            {plant.lastReview.factsChangedSince && " The facts have changed since, so it needs another look."}
          </p>
        )}

        <div className="rv-facts">
          {factGroups(plant).map((g) => (
            <section key={g.title} className="rv-facts__group" aria-label={g.title}>
              <h3 className="rv-facts__title">{g.title}</h3>
              <dl>
                {g.facts.map((f) => (
                  <div key={f.label} className={f.warn ? "rv-fact rv-fact--warn" : "rv-fact"}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <p className="fl-source">From the plant sheet · curated by {plant.curatedBy}</p>
      </Window>

      <Window label={`photos · ${plant.photos.length} found`} tone="paper" className="rv-photos">
        {plant.photos.length === 0 ? (
          <p className="lp-body">No openly licensed photos found yet. This plant needs a manual search or a photo of our own.</p>
        ) : (
          <>
            <p className="lp-body-sm">
              Check each photo shows this plant. Pick one main photo of the whole plant, and one close-up of the flower or leaves.
            </p>
            <ul className="rv-photo-grid">
              {plant.photos.map((ph) => {
                const choice = draft.photos.find((c) => c.id === ph.id) ?? ph;
                const set = (c: "habit" | "detail" | "rejected" | "candidate") =>
                  onDraft({ ...draft, photos: choosePhoto(draft.photos, ph.id, c) });
                const on = (c: string) =>
                  (c === "rejected" && choice.status === "rejected") || (c !== "rejected" && choice.kind === c);
                return (
                  <li key={ph.id} className={`rv-photo rv-photo--${choice.status}`}>
                    <a href={ph.imageUrl ?? ph.thumbUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="rv-photo__img">
                      {ph.thumbUrl ? <img src={ph.thumbUrl} alt={`Candidate photo of ${common}`} loading="lazy" /> : null}
                    </a>
                    <div className="rv-photo__choices" role="group" aria-label="Use this photo as">
                      {(
                        [
                          ["habit", "Main"],
                          ["detail", "Close-up"],
                          ["rejected", "Reject"],
                        ] as const
                      ).map(([c, label]) => (
                        <button
                          key={c}
                          type="button"
                          aria-pressed={on(c)}
                          className={`rv-photo__choice rv-photo__choice--${c}${on(c) ? " rv-photo__choice--on" : ""}`}
                          onClick={() => set(on(c) ? "candidate" : c)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="rv-photo__credit">
                      <span className="lp-chip rv-photo__license">{ph.license}</span> {ph.credit}
                    </p>
                    {ph.sourceUrl && (
                      <a className="rv-photo__source" href={ph.sourceUrl} target="_blank" rel="noopener noreferrer">
                        Check the source
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Window>

      <Window label="garden-game · drawing" tone="paper" className="rv-sprite">
        {sprite ? (
          <>
            {sprite.exact ? (
              <p className="lp-body">
                Drawn in Nativo Garden as <strong>{sprite.sprite.gameName}</strong>.
              </p>
            ) : (
              <p className="rv-warn">
                The game draws <strong>{sprite.sprite.gameName}</strong> (<em>{sprite.sprite.scientificName}</em>), a different
                species from this plant. Should the game change, or the sheet?
              </p>
            )}
            <p className="lp-body-sm">
              The game says: {sprite.sprite.gameText ? `“${sprite.sprite.gameText}”` : "no description."}
            </p>
            {sprite.exact && sprite.sprite.gameText && (
              <p className={mismatches.length ? "rv-warn" : "rv-ok"}>
                {mismatches.length ? mismatches.join(" ") : "Its water and bloom words match the sheet."}
              </p>
            )}
            <div className="rv-sprite__check" role="radiogroup" aria-label="The drawing and words">
              {(
                [
                  ["ok", "Drawing and words look right"],
                  ["problem", "Something's wrong"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={draft.spriteCheck === v}
                  className={`fl-chip-button rv-chip${draft.spriteCheck === v ? " fl-chip-button--on" : ""}`}
                  onClick={() => onDraft({ ...draft, spriteCheck: draft.spriteCheck === v ? null : v })}
                >
                  {label}
                </button>
              ))}
            </div>
            <a href="/#hero-title" target="_blank" rel="noopener noreferrer" className="rv-link">
              Open the game to see the drawing
            </a>
          </>
        ) : (
          <p className="lp-body">Not in the garden game yet, so there is no drawing to check.</p>
        )}
      </Window>

      <div className="rv-decide">
        <label className="rv-notes">
          <span className="rv-notes__label">Your notes {state !== "passed" && <span className="fl-muted">(needed to fail)</span>}</span>
          <textarea
            ref={notesRef}
            value={draft.notes}
            onChange={(e) => onDraft({ ...draft, notes: e.target.value })}
            rows={4}
            placeholder="What's right, what's wrong, what to change"
          />
        </label>
        <p className="rv-keys fl-source">Keys: A approve · F fail · S skip. On a phone, swipe the card right to approve or left to fail.</p>
      </div>

      <div className="rv-actionbar">
        {(problem || gaps.length > 0) && (
          <p className={problem ? "fl-error rv-actionbar__msg" : "rv-gaps rv-actionbar__msg"} role={problem ? "alert" : undefined}>
            {problem ?? gaps.join(" ")}
          </p>
        )}
        <div className="rv-decide__buttons">
          <button type="button" className="lp-button rv-button rv-button--fail" disabled={saving} onClick={() => decide("fail")}>
            Fail
          </button>
          {canSkip && (
            <button type="button" className="lp-button lp-button--paper rv-button" disabled={saving} onClick={onSkip}>
              Skip
            </button>
          )}
          <button type="button" className="lp-button lp-button--green rv-button rv-button--pass" disabled={saving} onClick={() => decide("pass")}>
            {saving ? "Saving…" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}
