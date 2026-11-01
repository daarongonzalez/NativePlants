import type { CSSProperties, ReactNode } from "react";

/** Shows different copy on phone and desktop. Only one is ever visible or read aloud. */
export function Responsive({ desktop, phone }: { desktop: ReactNode; phone: ReactNode }) {
  return (
    <>
      <span className="lp-only-desktop">{desktop}</span>
      <span className="lp-only-phone">{phone}</span>
    </>
  );
}

/** Points a CSS property at a colour token, e.g. a seed colour. */
export const tokenColor = (token: string): CSSProperties =>
  ({ "--dot-color": `var(${token})` }) as CSSProperties;

type WindowTone = "paper" | "gold" | "green";

/**
 * A rounded "window" card with a title bar. The label is set in mono, like a
 * file name, and the optional number sits in a circle before it.
 */
export function Window({
  label,
  number,
  tone = "paper",
  size = "md",
  dots,
  className = "",
  children,
}: {
  label: ReactNode;
  number?: number;
  tone?: WindowTone;
  size?: "md" | "lg";
  dots?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`lp-window lp-window--${tone} lp-window--${size} ${className}`}>
      <div className="lp-window__bar">
        <span className="lp-window__title">
          {number !== undefined && (
            <span className="lp-window__num" aria-hidden="true">
              {number}
            </span>
          )}
          <span className="lp-mono">{label}</span>
        </span>
        {dots && (
          <span className="lp-window__dots" aria-hidden="true">
            <span />
            <span className="lp-only-desktop-inline" />
            <span className="lp-window__dot--on" />
          </span>
        )}
      </div>
      <div className="lp-window__body">{children}</div>
    </div>
  );
}

/** A small labelled figure: label on top, big value, optional source. */
export function Stat({
  label,
  value,
  source,
  small,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  source?: ReactNode;
  small?: boolean;
  tone?: "gold";
}) {
  return (
    <div className={`lp-stat${tone ? ` lp-stat--${tone}` : ""}`}>
      <span className="lp-stat__label">{label}</span>
      <span className={`lp-stat__value${small ? " lp-stat__value--sm" : ""}`}>{value}</span>
      {source && <span className="lp-stat__source lp-only-desktop">{source}</span>}
    </div>
  );
}

/** The flower drawn on a planted square and on each seed slot. */
export function Flower({ token, stem = true }: { token: string; stem?: boolean }) {
  return (
    <span className="lp-flower" style={tokenColor(token)} aria-hidden="true">
      <span className="lp-flower__head" />
      {stem && (
        <>
          <span className="lp-flower__stem" />
          <span className="lp-flower__leaf" />
        </>
      )}
    </span>
  );
}
