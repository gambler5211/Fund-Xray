import { supabaseServer } from "@/lib/supabase/server";
import type { BenchmarkKey, IndexRow } from "@/lib/rotationShared";

/**
 * Alignment (Week 3, Day 1): your money by quadrant now, what it was last week, and the market's.
 * "Gaining" is Leading + Improving; "losing ground" is Weakening + Lagging. See
 * engine/fund_xray_engine/alignment.py for the same rules in the job that stores the weekly rows.
 */

export type AlignmentChange = {
  total: number; // gaining now minus last week, points
  fromSectors: number | null; // the part from quadrants moving under your current holdings
  fromYou: number | null; // the rest (trades, prices); null without a stored last week
};

export type MarketAlignment = { stocks: number; gaining: number; losing: number };

const DAY = 24 * 60 * 60 * 1000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
/** Monday of the week holding this date (dates are UTC calendar days). */
export const weekStart = (d: string) => {
  const t = new Date(`${d}T00:00:00Z`).getTime();
  const wd = (new Date(t).getUTCDay() + 6) % 7;
  return iso(t - wd * DAY);
};

/** Your gaining share with this week's holdings but last week's quadrants. */
export function gainingIfStill(rows: IndexRow[]): number | null {
  if (!rows.some((r) => r.held && r.prev)) return null;
  let g = 0;
  for (const r of rows) if (r.held && r.prev && (r.prev.quadrant === "leading" || r.prev.quadrant === "improving")) g += r.held.share;
  return g;
}

/** Last week's stored gaining share, and this week's market split, against one benchmark. */
export async function loadAlignmentContext(userId: string, benchmark: BenchmarkKey, asOf: string) {
  const supabase = await supabaseServer();
  const ws = weekStart(asOf);
  const lastWs = iso(new Date(`${ws}T00:00:00Z`).getTime() - 7 * DAY);
  const [last, market] = await Promise.all([
    supabase.from("alignment_weekly").select("gaining").eq("user_id", userId).eq("benchmark_key", benchmark).eq("week_start", lastWs).maybeSingle(),
    supabase.from("market_alignment").select("stocks, gaining, losing").eq("benchmark_key", benchmark).eq("week_start", ws).maybeSingle(),
  ]);
  return {
    lastWeekGaining: last.data ? Number(last.data.gaining) : null,
    market: market.data ? ({ stocks: Number(market.data.stocks), gaining: Number(market.data.gaining), losing: Number(market.data.losing) } as MarketAlignment) : null,
  };
}

/** The change since last week. With a stored last week and last week's quadrants it splits into
 *  sectors and you; without a stored last week it is the sectors' part alone (same holdings, last
 *  week's quadrants). */
export function alignmentChange(gainingNow: number, lastWeek: number | null, ifStill: number | null): AlignmentChange | null {
  if (lastWeek !== null) {
    const total = gainingNow - lastWeek;
    if (ifStill === null) return { total, fromSectors: null, fromYou: null };
    return { total, fromSectors: gainingNow - ifStill, fromYou: total - (gainingNow - ifStill) };
  }
  if (ifStill === null) return null;
  return { total: gainingNow - ifStill, fromSectors: gainingNow - ifStill, fromYou: null };
}

const pts = (n: number) => {
  const v = Math.abs(n) >= 1 ? String(Math.round(Math.abs(n))) : Math.abs(n).toFixed(1);
  return `${v} point${v === "1" ? "" : "s"}`;
};
const QUIET = 0.5; // under half a point reads as unchanged

/** ", up 6 points from last week" — or "" when there's nothing to compare. */
export function changePhrase(c: AlignmentChange | null): string {
  if (!c) return "";
  if (Math.abs(c.total) < QUIET) return ", about the same as last week";
  return `, ${c.total > 0 ? "up" : "down"} ${pts(c.total)} from last week`;
}

/** The sentence explaining where the change came from. */
export function changeDetail(c: AlignmentChange | null): string {
  if (!c || Math.abs(c.total) < QUIET || c.fromSectors === null) return "";
  if (c.fromYou === null) return "That change is the sectors moving; there's no record of your holdings last week to compare yours.";
  if (Math.abs(c.fromYou) < QUIET) return "All of it came from sectors moving, not from changes you made.";
  if (Math.abs(c.fromSectors) < QUIET) return "It came from changes in your holdings; the sectors themselves barely moved.";
  const s = `${c.fromSectors > 0 ? "+" : "−"}${pts(c.fromSectors)}`;
  const y = `${c.fromYou > 0 ? "+" : "−"}${pts(c.fromYou)}`;
  return `Sectors moving account for ${s}; your trades and price moves for ${y}.`;
}
