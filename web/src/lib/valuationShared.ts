/**
 * The valuation panel's data and wording (Week 3, Day 7). Shared by server and client code.
 * Each view is worked out nightly by engine/fund_xray_engine/valuation.py; nothing is computed here.
 * Wording describes what the price assumes. It never says buy, sell, cheap, expensive or target.
 */

export type ViewInputs = Record<string, number | string | null | undefined>;

export type PeView = {
  value?: number;
  low?: number;
  high?: number;
  missing?: string;
  formula?: string;
  inputs?: ViewInputs;
};
export type GrahamView = { value?: number; missing?: string; formula?: string; note?: string; inputs?: ViewInputs };
export type DcfView = { value?: number; missing?: string; formula?: string; inputs?: ViewInputs };
export type GrowthView = { value?: number; what?: string; years?: number; missing?: string };

export type Valuation = {
  symbol: string;
  computedAt: string;
  price: number | null;
  priceDate: string | null;
  basis: string | null;
  financial: boolean;
  pe: PeView;
  graham: GrahamView;
  reverseDcf: DcfView;
  pastGrowth: GrowthView;
  sources: { period_end: string; url: string }[];
};

export type ValuationMap = Record<string, Valuation>; // NSE symbol -> views

/** "Jun 2026" from an ISO date. */
export function monthYear(iso: string | null | undefined): string {
  if (!iso) return "–";
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** "16%" / "−4%" for a growth rate stored as a fraction. */
export function growthPct(g: number): string {
  const p = Math.round(g * 100);
  return p < 0 ? `−${Math.abs(p)}%` : `${p}%`;
}

/** "Today's price implies 16% a year; the last 3 years managed 11%." */
export function dcfSentence(v: Valuation): string | null {
  const g = v.reverseDcf.value;
  if (g === undefined) return null;
  const implied = `Today's price implies free cash flow growing ${growthPct(g)} a year for 10 years`;
  const past = v.pastGrowth;
  if (past.value === undefined || !past.years) return `${implied}.`;
  const what = past.what === "profit" ? "profit" : "free cash flow";
  return `${implied}; over the last ${past.years === 1 ? "year" : `${past.years} years`} ${what} grew ${growthPct(past.value)} a year.`;
}

/** The latest filing used: what the "as of" line links to. */
export function latestSource(v: Valuation): { period_end: string; url: string } | null {
  return v.sources.length ? v.sources[v.sources.length - 1] : null;
}
