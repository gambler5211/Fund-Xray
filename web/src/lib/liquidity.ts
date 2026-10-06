import { supabaseServer } from "@/lib/supabase/server";
import type { HoldingRowData } from "@/lib/holdings";
import { instrumentKey } from "@/lib/sectorsShared";
import { VOLUME_DAYS, daysToSell, type LiquidityMap } from "@/lib/liquidityShared";

export * from "@/lib/liquidityShared";

/**
 * Each holding's NSE symbol, keyed "EXCHANGE:SYMBOL". Kite lists many holdings under BSE (where they
 * were bought); the ISIN finds the same company in NSE's lists, and the Kite symbol is the fallback.
 */
export async function nseSymbols(holdings: HoldingRowData[]): Promise<Record<string, string>> {
  const supabase = await supabaseServer();
  const isins = [...new Set(holdings.map((h) => h.isin).filter((x): x is string => !!x))];
  const { data } = isins.length ? await supabase.from("industry_map").select("isin, symbol").in("isin", isins) : { data: [] };
  const byIsin = new Map(((data ?? []) as { isin: string; symbol: string }[]).map((r) => [r.isin, r.symbol]));
  return Object.fromEntries(holdings.map((h) => [instrumentKey(h), (h.isin && byIsin.get(h.isin)) || h.symbol]));
}

/** Each holding's 20-day average NSE volume and days to sell, from stock_prices. */
export async function liquidityFor(holdings: HoldingRowData[], nse: Record<string, string>): Promise<LiquidityMap> {
  const symbols = [...new Set(holdings.map((h) => nse[instrumentKey(h)]))];
  const out: LiquidityMap = {};
  if (!symbols.length) return out;
  const supabase = await supabaseServer();
  const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // 20 sessions with room for holidays
  const { data } = await supabase
    .from("stock_prices")
    .select("symbol, date, volume")
    .in("symbol", symbols)
    .gte("date", since)
    .order("date", { ascending: false })
    .limit(symbols.length * 40);
  const vols = new Map<string, number[]>();
  for (const r of (data ?? []) as { symbol: string; volume: number | string | null }[]) {
    const list = vols.get(r.symbol) ?? [];
    if (list.length < VOLUME_DAYS && r.volume !== null) list.push(Number(r.volume));
    vols.set(r.symbol, list);
  }
  for (const h of holdings) {
    const list = vols.get(nse[instrumentKey(h)]) ?? [];
    const avg = list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
    out[instrumentKey(h)] = { avgVolume: avg, days: daysToSell(h.quantity, avg), sessions: list.length };
  }
  return out;
}
