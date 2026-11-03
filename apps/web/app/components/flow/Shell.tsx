import type { ReactNode } from "react";
import { Nav } from "../landing/Nav";

export const STEPS = ["Your address", "Your ground", "Plan and rebate", "Get your plan"] as const;

/** The four steps, with the current one lifted in gold. Step 4 arrives with email. */
export function FlowSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="fl-steps" aria-label="Your progress">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "on" : "next";
        return (
          <li key={label} className={`fl-step fl-step--${state}`} aria-current={state === "on" ? "step" : undefined}>
            <span className="fl-step__num" aria-hidden="true">
              {n}
            </span>
            <span className="fl-step__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Nav, steps and footer around each page of the flow. */
export function FlowShell({ step, children }: { step: 1 | 2 | 3; children: ReactNode }) {
  return (
    <div className="lp fl">
      <Nav />
      <main className="lp-wrap fl-main">
        <FlowSteps current={step} />
        {children}
      </main>
      <footer className="lp-wrap fl-footer">
        <span className="lp-wordmark lp-wordmark--footer">nativo</span>
        <span>Advice, not a guarantee. Only the rebate program can approve a project.</span>
      </footer>
    </div>
  );
}
