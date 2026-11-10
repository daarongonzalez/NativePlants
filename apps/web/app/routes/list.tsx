import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/list";
import branch from "../../../../design/nativo/assets/Branch/branch-07-green.svg?url";
import flowStyles from "../styles/flow.css?url";
import { PageHead } from "../components/site/Content";
import { PageShell } from "../components/site/SiteChrome";
import { formatDate, inches } from "../lib/flow";
import { shareImageMeta } from "../lib/meta";
import { removePlant, setQuantity, totalPlants, updateList, useSavedList, writeList } from "../lib/plant-list";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: flowStyles }];

export function meta(_: Route.MetaArgs) {
  return [
    { title: "My plant list · nativo" },
    { name: "description", content: "The plants you've saved, ready to print and take to a nursery." },
    { name: "robots", content: "noindex" },
    ...shareImageMeta,
  ];
}

const FORM_LABELS: Record<string, string> = {
  groundcover: "Groundcover",
  wildflower: "Wildflower",
  grass: "Grass",
  shrub: "Shrub",
  tree: "Tree",
  vine: "Vine",
};

export default function PlantList() {
  const { list, ready } = useSavedList();
  const [storageError, setStorageError] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const change = (ok: boolean) => setStorageError(!ok);
  const today = formatDate(new Date().toISOString());
  const hasDrafts = list.some((p) => p.reviewStatus !== "published");

  return (
    <PageShell>
      <div className="print-only">
        <p className="ct-mono">nativo · my plant list · printed {today}</p>
      </div>

      <PageHead
        badge="Your list"
        title={
          <>
            Take this <span className="lp-accent">to the nursery</span>
          </>
        }
        lead="The plants you've saved, with how many your plan needs. Print it, or show it on your phone at the counter."
      >
        <img src={branch} alt="" className="ct-head__art no-print" />
      </PageHead>

      {!ready ? (
        <p className="lp-body" role="status">
          Opening your list…
        </p>
      ) : list.length === 0 ? (
        <section className="ct-empty" aria-labelledby="empty-title">
          <h2 id="empty-title" className="lp-h3">
            Your list is empty, for now
          </h2>
          <p className="lp-body-lg">
            In the planner, pick a plant and press “Save to my list”. Or check a plan and save all its plants in one go.
          </p>
          <Link to="/plan" className="lp-button lp-button--green ct-button">
            Open the planner
          </Link>
        </section>
      ) : (
        <div className="ct-layout">
          <section aria-labelledby="list-title" className="ct-prose">
            <h2 id="list-title" className="lp-h3">
              {list.length} plant{list.length === 1 ? "" : "s"} · {totalPlants(list)} to buy
            </h2>
            <ul className="ct-list">
              {list.map((p) => (
                <li key={p.id} className="ct-list__row">
                  <span className="ct-list__name">
                    <span className="ct-list__common">{p.commonName}</span>
                    <span className="np-sci-name">{p.scientificName}</span>
                    <span className="ct-list__facts">
                      {p.plantForm ? `${FORM_LABELS[p.plantForm] ?? p.plantForm} · ` : ""}
                      {inches(p.matureHeightCm)} in tall · {inches(p.matureWidthCm)} in wide when grown
                      {p.staysUnder24In ? " · park strip safe" : ""}
                      {p.reviewStatus !== "published" ? " · draft data" : ""}
                    </span>
                  </span>
                  <span className="ct-list__actions">
                    <span className="ct-qty" role="group" aria-label={`How many ${p.commonName}`}>
                      <button
                        type="button"
                        className="lp-button lp-button--paper no-print"
                        aria-label={`One fewer ${p.commonName}`}
                        disabled={p.quantity <= 1}
                        onClick={() => change(updateList((l) => setQuantity(l, p.id, p.quantity - 1)))}
                      >
                        −
                      </button>
                      <span className="ct-qty__value" aria-live="polite">
                        × {p.quantity}
                      </span>
                      <button
                        type="button"
                        className="lp-button lp-button--paper no-print"
                        aria-label={`One more ${p.commonName}`}
                        onClick={() => change(updateList((l) => setQuantity(l, p.id, p.quantity + 1)))}
                      >
                        +
                      </button>
                    </span>
                    <button
                      type="button"
                      className="lp-button lp-button--paper ct-button no-print"
                      onClick={() => change(updateList((l) => removePlant(l, p.id)))}
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="fl-source">
              Counts space each plant at its grown width. Ask your nursery about pot sizes: smaller pots cost less and
              settle in well.
              {hasDrafts ? " Plants marked draft data are still awaiting expert review." : ""}
            </p>
            {storageError && (
              <p className="fl-error" role="alert">
                Your browser would not save that change. Private windows sometimes block saving.
              </p>
            )}
          </section>

          <aside className="ct-aside">
            <div className="lp-note lp-note--peach ct-note ct-note--right">
              <span className="lp-note__kicker">AT THE NURSERY</span>
              <p>Ask for each plant by its scientific name. Common names change from place to place.</p>
            </div>
            <button type="button" className="lp-button lp-button--green ct-button" onClick={() => window.print()}>
              Print my list
            </button>
            <Link to="/plan" className="lp-button lp-button--paper ct-button">
              Add more plants
            </Link>
            {confirmClear ? (
              <div className="ct-confirm" role="group" aria-label="Clear the whole list?">
                <p className="lp-body-sm">Clear every plant from this list? This cannot be undone.</p>
                <button
                  type="button"
                  className="lp-button lp-button--paper ct-button"
                  onClick={() => {
                    change(writeList([]));
                    setConfirmClear(false);
                  }}
                >
                  Yes, clear it
                </button>
                <button type="button" className="lp-button lp-button--paper ct-button" onClick={() => setConfirmClear(false)}>
                  Keep my list
                </button>
              </div>
            ) : (
              <button type="button" className="lp-button lp-button--paper ct-button" onClick={() => setConfirmClear(true)}>
                Clear the list
              </button>
            )}
            <p className="fl-source">Saved in this browser only. Nothing is sent to us.</p>
          </aside>
        </div>
      )}
    </PageShell>
  );
}
