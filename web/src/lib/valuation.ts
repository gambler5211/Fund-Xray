import { supabaseServer } from "@/lib/supabase/server";
import type { Valuation, ValuationMap } from "@/lib/valuationShared";

export * from "@/lib/valuationShared";

/**
 * Whether the signed-in account may see the valuation panel. Per-stock values sit close to a price
 * target under SEBI's Research Analyst rules, so only accounts in feature_access see them; the
 * database enforces the same rule on valuation_views, so this only decides what to draw.
 */
export async function hasValuationAccess(): Promise<boolean> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("has_feature", { p_feature: "valuation" });
  return !error && data === true;
}

/** This account's valuation views (written nightly), keyed by NSE symbol. Empty without access. */
export async function loadValuations(userId: string): Promise<ValuationMap> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("valuation_views").select("*").eq("user_id", userId);
  const out: ValuationMap = {};
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const v: Valuation = {
      symbol: String(r.symbol),
      computedAt: String(r.computed_at),
      price: r.price === null || r.price === undefined ? null : Number(r.price),
      priceDate: (r.price_date as string | null) ?? null,
      basis: (r.basis as string | null) ?? null,
      financial: Boolean(r.financial),
      pe: (r.pe ?? {}) as Valuation["pe"],
      graham: (r.graham ?? {}) as Valuation["graham"],
      reverseDcf: (r.reverse_dcf ?? {}) as Valuation["reverseDcf"],
      pastGrowth: (r.past_growth ?? {}) as Valuation["pastGrowth"],
      sources: (r.sources ?? []) as Valuation["sources"],
    };
    out[v.symbol] = v;
  }
  return out;
}
