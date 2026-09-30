import { supabaseServer } from "@/lib/supabase/server";
import type { RsiMap } from "@/lib/indicatorsShared";

export * from "@/lib/indicatorsShared";

/** RSI(14) for these NSE symbols, from latest_indicators (written nightly). */
export async function rsiFor(symbols: string[]): Promise<RsiMap> {
  if (!symbols.length) return {};
  const supabase = await supabaseServer();
  const { data } = await supabase.from("latest_indicators").select("key, rsi14").eq("kind", "stock").in("key", [...new Set(symbols)]);
  const out: RsiMap = {};
  for (const r of (data ?? []) as { key: string; rsi14: number | string | null }[]) if (r.rsi14 !== null) out[r.key] = Number(r.rsi14);
  return out;
}
