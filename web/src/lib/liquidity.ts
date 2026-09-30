import { supabaseServer } from "@/lib/supabase/server";
import type { HoldingRowData } from "@/lib/holdings";
import { instrumentKey } from "@/lib/sectorsShared";
import { VOLUME_DAYS, daysToSell, type LiquidityMap } from "@/lib/liquidityShared";

export * from "@/lib/liquidityShared";

/** Each holding's 20-day average NSE volume and days to sell, from stock_prices. */
export async function liquidityFor(holdings: HoldingRowData[]): Promise<LiquidityMap> {
  const symbols = [...new Set(holdings.filter((h) => h.exchange === "NSE").map((h) => h.symbol))];
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
    const list = h.exchange === "NSE" ? (vols.get(h.symbol) ?? []) : [];
    const avg = list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
    out[instrumentKey(h)] = { avgVolume: avg, days: daysToSell(h.quantity, avg), sessions: list.length };
  }
  return out;
}
