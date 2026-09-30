/** RSI(14) wording and the allocation planner (Week 3, Day 4). Shared by server and client code. */

export type RsiMap = Record<string, number>; // NSE symbol or index key -> RSI(14)

/** Same bands as engine/fund_xray_engine/indicators.py: a description of the recent move, never a call. */
export function rsiWords(v: number): string {
  if (v >= 70) return "up hard over the last few weeks";
  if (v >= 55) return "rising over the last few weeks";
  if (v > 45) return "moving sideways over the last few weeks";
  if (v > 30) return "falling over the last few weeks";
  return "down hard over the last few weeks";
}

// --- Allocation planner ------------------------------------------------------------------

/** Index funds and equity index ETFs. Gold, silver and liquid ETFs are funds but not "index". */
export function isIndexFund(symbol: string, name: string, fund: boolean): boolean {
  if (!fund) return false;
  const s = `${symbol} ${name}`.toUpperCase();
  return !/(GOLD|SILVER|LIQUID|LIQUIDBEES|MONEY ?MARKET|GILT|BOND|OVERNIGHT)/.test(s);
}

export type Plan =
  | { state: "inside"; indexShare: number; low: number; high: number }
  | { state: "below"; indexShare: number; low: number; high: number; gap: number; nextToIndex: number | null; months: number | null }
  | { state: "above"; indexShare: number; low: number; high: number; gap: number; nextElsewhere: number | null; months: number | null };

/**
 * Where your index share sits against your target band, and what new money would bring it back.
 * below: x more into index gets you to the low edge: (I + x) / (V + x) = low  ->  x = (low·V − I) / (1 − low)
 * above: y more into everything else gets you to the high edge: I / (V + y) = high  ->  y = I / high − V
 * With a monthly amount, next month's money goes to the side that's short (all of it, or just what's
 * needed), and months = how many months of that amount it takes.
 */
export function plan(value: number, indexValue: number, lowPct: number, highPct: number, monthly: number | null): Plan {
  const share = value > 0 ? (100 * indexValue) / value : 0;
  const low = lowPct / 100;
  const high = highPct / 100;
  const m = monthly && monthly > 0 ? monthly : null;
  if (share < lowPct) {
    const gap = (low * value - indexValue) / (1 - low);
    return { state: "below", indexShare: share, low: lowPct, high: highPct, gap, nextToIndex: m ? Math.min(m, gap) : null, months: m ? Math.ceil(gap / m) : null };
  }
  if (share > highPct) {
    const gap = indexValue / high - value;
    return { state: "above", indexShare: share, low: lowPct, high: highPct, gap, nextElsewhere: m ? Math.min(m, gap) : null, months: m ? Math.ceil(gap / m) : null };
  }
  return { state: "inside", indexShare: share, low: lowPct, high: highPct };
}
