import { useEffect, type ReactNode } from "react";
import { Link, useNavigation } from "react-router";
import { Nav } from "../landing/Nav";
import { Window } from "../landing/primitives";
import { SiteFooter } from "./SiteFooter";

/**
 * A small gold pill while the next page loads. Waits a beat so quick
 * navigations do not flash it.
 */
export function LoadingPill() {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  return (
    <div aria-live="polite" className="no-print">
      {busy && (
        <div className="site-loading" role="status">
          <span className="site-loading__dot" aria-hidden="true" />
          {navigation.state === "submitting" ? "Working on it…" : "Loading…"}
        </div>
      )}
    </div>
  );
}

/**
 * Opens every collapsed section before printing, so answers and rule text are
 * on paper too, and closes them again afterwards.
 */
export function PrintOpener() {
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const before = () => {
      opened = Array.from(document.querySelectorAll<HTMLDetailsElement>("details:not([open])"));
      opened.forEach((d) => (d.open = true));
    };
    const after = () => {
      opened.forEach((d) => (d.open = false));
      opened = [];
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  return null;
}

/** Nav, a main column and the footer, for every page outside the flow. */
export function PageShell({ children, footerNote }: { children: ReactNode; footerNote?: string }) {
  return (
    <div className="lp">
      <Nav />
      <main className="lp-wrap ct-main" id="main">
        {children}
      </main>
      <SiteFooter {...(footerNote ? { note: footerNote } : {})} />
    </div>
  );
}

/** The error page body: a window that says what happened and what to do next. */
export function ErrorPanel({
  code,
  title,
  detail,
  showRetry,
}: {
  code: string;
  title: string;
  detail: string;
  showRetry: boolean;
}) {
  return (
    <div className="site-error">
      <Window label={`error · ${code}`} tone="paper" size="lg">
        <h1 className="lp-h2">{title}</h1>
        <p className="lp-lead">{detail}</p>
        <div className="site-error__actions">
          {showRetry && (
            <button type="button" className="lp-button lp-button--green ct-button" onClick={() => window.location.reload()}>
              Try again
            </button>
          )}
          <Link to="/" className="lp-button lp-button--paper ct-button">
            Back to the start
          </Link>
        </div>
      </Window>
      <aside className="lp-note lp-note--sky site-error__note">
        <span className="lp-note__kicker">SAGE SAYS</span>
        <p>Even the hardiest penstemon has an off day. Your plant list is safe: it lives in this browser.</p>
        <Link to="/list">Open my plant list</Link>
      </aside>
    </div>
  );
}
