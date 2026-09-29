import { supabaseServer } from "@/lib/supabase/server";
import type { HoldingRowData } from "@/lib/holdings";
import { instrumentKey, looksLikeFund, type SectorMap } from "@/lib/sectorsShared";

export * from "@/lib/sectorsShared";

/** A sector for every holding: your own choice first, then NSE's classification by ISIN, then by symbol. */
export async function sectorsFor(holdings: HoldingRowData[]): Promise<SectorMap> {
  const supabase = await supabaseServer();
  const isins = holdings.map((h) => h.isin).filter((x): x is string => !!x);
  const symbols = holdings.map((h) => h.symbol);
  const [byIsin, bySymbol, mine] = await Promise.all([
    isins.length ? supabase.from("industry_map").select("isin, industry").in("isin", isins) : Promise.resolve({ data: [] }),
    supabase.from("industry_map").select("symbol, industry").in("symbol", symbols),
    supabase.from("sector_overrides").select("instrument, industry"),
  ]);
  const isinMap = new Map((byIsin.data ?? []).map((r: { isin: string; industry: string }) => [r.isin, r.industry]));
  const symMap = new Map((bySymbol.data ?? []).map((r: { symbol: string; industry: string }) => [r.symbol, r.industry]));
  const own = new Map((mine.data ?? []).map((r: { instrument: string; industry: string }) => [r.instrument, r.industry]));

  const out: SectorMap = {};
  for (const h of holdings) {
    const key = instrumentKey(h);
    const yours = own.get(key);
    const nse = (h.isin && isinMap.get(h.isin)) || symMap.get(h.symbol);
    out[key] = yours
      ? { industry: yours, source: "you" }
      : nse
        ? { industry: nse, source: "nse" }
        : looksLikeFund(h.symbol, h.name)
          ? { industry: "ETFs & funds", source: "auto" }
          : { industry: null, source: null };
  }
  return out;
}

