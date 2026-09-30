import { supabaseServer } from "@/lib/supabase/server";

/** One row of portfolio_concentration, written nightly by jobs/compute_concentration.py. */
export type ConcentrationCluster = { symbols: string[]; names: string[]; share: number; correlation: number | null };
export type Concentration = {
  computedAt: string;
  snapshotAt: string;
  pricesTo: string | null;
  holdings: number;
  effectiveHoldings: number;
  effectiveBets: number;
  clusters: ConcentrationCluster[];
  leftOut: { symbol: string; name: string; share: number }[];
  weeks: number;
  cut: number;
};

export async function loadConcentration(userId: string): Promise<Concentration | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("portfolio_concentration").select("*").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  return {
    computedAt: data.computed_at,
    snapshotAt: data.snapshot_at,
    pricesTo: data.prices_to,
    holdings: Number(data.holdings),
    effectiveHoldings: Number(data.effective_holdings),
    effectiveBets: Number(data.effective_bets),
    clusters: (data.clusters ?? []) as ConcentrationCluster[],
    leftOut: (data.left_out ?? []) as Concentration["leftOut"],
    weeks: Number(data.weeks),
    cut: Number(data.cut),
  };
}

/** "12 stocks, but they behave like about 5 separate bets" */
export function spreadHeadline(c: Concentration): string {
  const bets = Math.max(1, Math.round(c.effectiveBets));
  const stocks = `${c.holdings} ${c.holdings === 1 ? "holding" : "holdings"}`;
  if (bets >= c.holdings - 0.5) return `${stocks}, and they mostly move on their own`;
  return `${stocks}, but they behave like about ${bets} separate ${bets === 1 ? "bet" : "bets"}`;
}

/** The sentence under it: size-weighted count vs behaviour-weighted count. */
export function spreadDek(c: Concentration): string {
  const eh = Math.max(1, Math.round(c.effectiveHoldings));
  const sized = eh < c.holdings - 0.5 ? `By size alone they count as about ${eh}, because a few are much bigger than the rest. ` : "";
  return `${sized}Holdings whose weekly prices moved together over the last year (correlation above ${c.cut}) are grouped below as one bet.`;
}
