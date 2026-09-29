import { pct as fmtPct, rupees, rupeesShort, signedPct } from "@/lib/format";

/** ₹2,89,167 in tabular figures. Pass short for ₹2.89 L. */
export function Rupees({ value, short = false, className = "" }: { value: number; short?: boolean; className?: string }) {
  return <span className={`figures ${className}`}>{short ? rupeesShort(value) : rupees(value)}</span>;
}

/** A change in %, coloured and always carrying its sign so colour is never the only cue. */
export function Change({ value, digits = 2, className = "" }: { value: number; digits?: number; className?: string }) {
  const tone = value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-ink-3";
  return <span className={`figures ${tone} ${className}`}>{signedPct(value, digits)}</span>;
}

/** A share of the portfolio, e.g. 38.9%. */
export function Share({ value, digits = 1, className = "" }: { value: number; digits?: number; className?: string }) {
  return <span className={`figures ${className}`}>{fmtPct(value, digits)}</span>;
}
