import type { ReactNode } from "react";
import { CONFIDENCE_LABELS, sourceLabel, type Provenance } from "../../lib/flow";

/** Confidence in words and colour. Low confidence also gets a dashed border. */
export function ConfidenceChip({ level }: { level: string }) {
  return (
    <span className="np-confidence fl-conf" data-level={level}>
      {CONFIDENCE_LABELS[level] ?? level}
    </span>
  );
}

/**
 * The signature value: label, the value in mono, a confidence chip and where
 * it came from. Every measured value on the report uses it.
 */
export function AttributedValue({
  label,
  value,
  unit,
  meaning,
  provenance,
  words = false,
  showNote = true,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  meaning?: string;
  provenance: Provenance | undefined;
  /** A word answer ("Loam") rather than a measured number: set in display type, not mono. */
  words?: boolean;
  /** Leave out the source note when a nearby caption already says it. */
  showNote?: boolean;
}) {
  return (
    <div className="fl-value">
      <div className="fl-value__head">
        <span className="fl-value__label">{label}</span>
        {provenance && <ConfidenceChip level={provenance.confidence} />}
      </div>
      <div className="fl-value__figure">
        <span className={words ? "fl-value__words" : "np-value"}>{value}</span>
        {unit && <span className="fl-value__unit">{unit}</span>}
      </div>
      {meaning && <p className="fl-value__meaning">{meaning}</p>}
      <p className="fl-source">
        {provenance ? sourceLabel(provenance.source) : "Source not recorded"}
        {showNote && provenance?.note ? ` · ${provenance.note}` : ""}
      </p>
    </div>
  );
}
