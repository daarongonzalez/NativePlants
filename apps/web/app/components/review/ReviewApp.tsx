import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import type { ReviewListResponse, ReviewPlant } from "@np/shared";
import { matchSprite } from "../../content/garden-sprites";
import {
  STATE_LABELS,
  counts,
  matchesFilter,
  nextPlantId,
  reviewState,
  type PhotoChoice,
  type ReviewFilter,
} from "../../lib/review";
import { Window } from "../landing/primitives";
import { PlantCard, type Draft } from "./PlantCard";

type ActionResult =
  | { ok: true; plantId: string; reviewStatus: string; savedAt: string }
  | { ok: false; plantId: string | null; error: string };

const FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: "todo", label: "To review" },
  { value: "failed", label: "Failed" },
  { value: "passed", label: "Passed" },
  { value: "all", label: "All" },
];

/** The header bar: wordmark, page name and who is signed in. */
function ReviewHeader({ reviewer }: { reviewer?: string }) {
  return (
    <header className="lp-nav-wrap">
      <div className="lp-nav rv-bar">
        <span className="rv-bar__title">
          <Link to="/" className="lp-wordmark">
            nativo
          </Link>
          <span className="rv-bar__page">plant review</span>
        </span>
        {reviewer && <span className="rv-bar__who">{reviewer}</span>}
      </div>
    </header>
  );
}

/** When the list cannot load: not signed in, not a reviewer, or not set up yet. */
export function ReviewUnavailable({ status, error }: { status: number; error: string }) {
  const title =
    status === 401 ? "Please sign in again" : status === 403 ? "This page is for plant reviewers" : status === 503 ? "The review page isn't ready" : "We couldn't load the plants";
  return (
    <div className="lp rv">
      <ReviewHeader />
      <main className="lp-wrap rv-main">
        <Window label={`plant-review · ${status}`} tone="paper" size="lg" className="rv-unavailable">
          <h1 className="lp-h2">{title}</h1>
          <p className="lp-lead">{error}</p>
          <button type="button" className="lp-button lp-button--green rv-button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </Window>
      </main>
    </div>
  );
}

const freshDraft = (p: ReviewPlant): Draft => ({
  notes: "",
  spriteCheck: null,
  photos: p.photos.map((ph) => ({ id: ph.id, status: ph.status, kind: ph.kind, note: ph.note })),
});

/**
 * The review: a queue of plants, one card at a time. Approve or fail with the
 * buttons, the A and F keys, or a swipe on a phone. Each decision is saved as
 * it is made, and the next plant comes up.
 */
export function ReviewApp({ initial }: { initial: ReviewListResponse }) {
  const [plants, setPlants] = useState(initial.plants);
  const [filter, setFilter] = useState<ReviewFilter>("todo");
  const [currentId, setCurrentId] = useState<string | null>(() => nextPlantId(initial.plants, "todo", null) ?? initial.plants[0]?.id ?? null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [toast, setToast] = useState<string | null>(null);
  // The plant list starts open beside the card, and folded away on a phone.
  const [indexOpen, setIndexOpen] = useState(true);
  useEffect(() => setIndexOpen(!window.matchMedia("(max-width: 1023px)").matches), []);
  const fetcher = useFetcher<ActionResult>();
  const pending = useRef<{ plantId: string; decision: "pass" | "fail"; draft: Draft } | null>(null);

  const catalogue = useMemo(() => new Set(plants.map((p) => p.scientificName)), [plants]);
  const current = plants.find((p) => p.id === currentId) ?? null;
  const draft = current ? (drafts[current.id] ?? freshDraft(current)) : null;
  const tally = counts(plants);
  const done = tally.passed + tally.failed;
  const shown = plants.filter((p) => matchesFilter(p, filter));

  const setDraft = (d: Draft) => current && setDrafts((all) => ({ ...all, [current.id]: d }));

  // When a save comes back, write it into the list and move on.
  useEffect(() => {
    const result = fetcher.data;
    const sent = pending.current;
    if (!result || !sent || fetcher.state !== "idle") return;
    pending.current = null;
    if (!result.ok) {
      setToast(`Not saved: ${result.error}`);
      return;
    }
    setPlants((list) =>
      list.map((p) =>
        p.id !== sent.plantId
          ? p
          : {
              ...p,
              reviewStatus: result.reviewStatus as ReviewPlant["reviewStatus"],
              reviewedBy: initial.reviewer,
              reviewedAt: result.savedAt,
              photos: p.photos.map((ph) => {
                const c = sent.draft.photos.find((x) => x.id === ph.id);
                return c ? { ...ph, status: c.status, kind: c.kind, note: c.note } : ph;
              }),
              lastReview: {
                decision: sent.decision,
                notes: sent.draft.notes.trim() || null,
                spriteCheck: sent.draft.spriteCheck,
                reviewerEmail: initial.reviewer,
                createdAt: result.savedAt,
                factsChangedSince: false,
              },
            },
      ),
    );
    setDrafts((all) => {
      const { [sent.plantId]: _saved, ...rest } = all;
      return rest;
    });
    const name = plants.find((p) => p.id === sent.plantId)?.commonNames[0] ?? "Plant";
    setToast(`${sent.decision === "pass" ? "Approved" : "Failed"}: ${name}. Saved.`);
    setCurrentId((id) => (id === sent.plantId ? (nextPlantId(plants, filter, sent.plantId, new Set([sent.plantId])) ?? id) : id));
  }, [fetcher.data, fetcher.state, filter, initial.reviewer, plants]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const decide = (decision: "pass" | "fail"): string | null => {
    if (!current || !draft) return null;
    if (fetcher.state !== "idle") return "Still saving the last one.";
    if (decision === "fail" && draft.notes.trim() === "") return "Say what needs to change before failing a plant.";
    const sprite = matchSprite(current.scientificName, catalogue);
    const spriteCheck = draft.spriteCheck ?? (sprite ? null : "none");
    pending.current = { plantId: current.id, decision, draft: { ...draft, spriteCheck } };
    fetcher.submit(
      {
        plantId: current.id,
        decision,
        notes: draft.notes.trim() || null,
        spriteCheck,
        photos: draft.photos.map((p: PhotoChoice) => ({ id: p.id, status: p.status, kind: p.kind, note: p.note })),
      } as never,
      { method: "post", encType: "application/json" },
    );
    return null;
  };

  const skip = () => current && setCurrentId(nextPlantId(plants, filter, current.id, new Set([current.id])) ?? current.id);

  const changeFilter = (f: ReviewFilter) => {
    setFilter(f);
    if (!current || !matchesFilter(current, f)) setCurrentId(nextPlantId(plants, f, null));
  };

  return (
    <div className="lp rv">
      <ReviewHeader reviewer={initial.reviewer} />
      <main className="lp-wrap rv-main">
        <section className="rv-head" aria-labelledby="rv-title">
          <h1 id="rv-title" className="lp-h2">
            Plant <span className="lp-accent">review</span>
          </h1>
          <div className="rv-progress" aria-label={`${done} of ${plants.length} plants reviewed`}>
            <span className="rv-progress__text np-value">
              {done} of {plants.length} reviewed
            </span>
            <span className="rv-progress__track" aria-hidden="true">
              <span className="rv-progress__fill" style={{ width: `${plants.length ? (done / plants.length) * 100 : 0}%` }} />
            </span>
          </div>
          <div className="rv-filters" role="radiogroup" aria-label="Show">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={filter === f.value}
                className={`fl-chip-button rv-chip${filter === f.value ? " fl-chip-button--on" : ""}`}
                onClick={() => changeFilter(f.value)}
              >
                {f.label} <span className="np-value">{tally[f.value]}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="rv-layout">
          <div className="rv-stage">
            {current && draft ? (
              <PlantCard
                key={current.id}
                plant={current}
                sprite={matchSprite(current.scientificName, catalogue)}
                draft={draft}
                onDraft={setDraft}
                onDecide={decide}
                onSkip={skip}
                saving={fetcher.state !== "idle"}
                canSkip={shown.length > 1}
              />
            ) : (
              <Window label="plant-review · done" tone="green" size="lg" className="rv-done">
                <h2 className="lp-h3">Nothing left here</h2>
                <p className="lp-body-lg">
                  {filter === "todo" ? "Every plant has a decision. Thank you!" : "No plants match this view."} Pick another view above to
                  look again.
                </p>
              </Window>
            )}
          </div>

          <aside className="rv-index" aria-label="All plants">
            <details open={indexOpen} onToggle={(e) => setIndexOpen(e.currentTarget.open)} className="rv-index__details">
              <summary className="rv-index__summary">
                {indexOpen ? "" : "Jump to a plant · "}
                {FILTERS.find((f) => f.value === filter)?.label} · {shown.length}
              </summary>
              <ul className="rv-index__list">
                {shown.map((p) => {
                  const s = reviewState(p);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={`rv-index__item${p.id === currentId ? " rv-index__item--on" : ""}`}
                        aria-current={p.id === currentId ? "true" : undefined}
                        onClick={() => setCurrentId(p.id)}
                      >
                        <span className={`rv-dot rv-dot--${s}`} aria-hidden="true" />
                        <span className="rv-index__name">
                          {p.commonNames[0]}
                          <span className="np-sci-name">{p.scientificName}</span>
                        </span>
                        <span className="fl-sr">{STATE_LABELS[s]}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
            <p className="fl-source">
              Approving publishes a plant for gardeners. Failing keeps it as a draft with your notes. Every decision is saved with
              your email and the date.
            </p>
          </aside>
        </div>
      </main>

      <div className="rv-toast" role="status" aria-live="polite">
        {toast && <span className="rv-toast__pill">{toast}</span>}
      </div>
    </div>
  );
}
