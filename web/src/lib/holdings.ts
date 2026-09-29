import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";

/** One holding as saved by the API (engine/fund_xray_engine/portfolio.py). */
export type HoldingRowData = {
  symbol: string;
  exchange: string;
  isin: string | null;
  name: string;
  quantity: number;
  t1_quantity: number;
  pledged_quantity: number;
  avg_price: number;
  last_price: number;
  close_price: number;
  invested: number;
  value: number;
  day_change: number;
  day_change_pct: number;
  pnl: number;
  pnl_pct: number;
  weight_pct: number;
  notes: string[];
};

export type PositionRow = { symbol: string; exchange: string; product: string; quantity: number; avg_price: number; last_price: number; pnl: number };

export type Totals = {
  invested: number;
  value: number;
  pnl: number;
  pnl_pct: number;
  day_change: number;
  day_change_pct: number;
  holdings_count: number;
  positions_count: number;
  positions_pnl: number;
};

export type Snapshot = { taken_at: string; holdings: HoldingRowData[]; positions: PositionRow[]; totals: Totals };

/** Your latest holdings snapshot, straight from Supabase (row-level security: yours only). */
export const latestSnapshot = cache(async (): Promise<Snapshot | null> => {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("holdings_snapshot")
    .select("taken_at, holdings, positions, totals")
    .order("taken_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Snapshot | null) ?? null;
});
