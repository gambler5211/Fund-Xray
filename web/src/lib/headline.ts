import { countWords, rupees, signedPct } from "@/lib/format";
import type { Snapshot } from "@/lib/holdings";

/** "Ten stocks worth ₹2,89,167, up ₹1,588 today" — the Portfolio lead, built from the numbers. */
export function portfolioHeadline(s: Snapshot): string {
  const t = s.totals;
  const move = Math.round(t.day_change);
  const today = move === 0 ? "flat today" : `${move > 0 ? "up" : "down"} ${rupees(Math.abs(move))} today`;
  return `${countWords(t.holdings_count, "stock")} worth ${rupees(t.value)}, ${today}`;
}

/** The sentence under the lead: overall return and the day's biggest mover. */
export function portfolioDek(s: Snapshot): string {
  const t = s.totals;
  const overall =
    Math.round(t.pnl) === 0
      ? `You've put in ${rupees(t.invested)}, and it's worth about the same.`
      : `You've put in ${rupees(t.invested)}; it's ${t.pnl > 0 ? "up" : "down"} ${rupees(Math.abs(t.pnl))} (${signedPct(t.pnl_pct)}) overall.`;
  const mover = [...s.holdings].sort((a, b) => Math.abs(b.day_change) - Math.abs(a.day_change))[0];
  if (!mover || Math.round(mover.day_change) === 0) return overall;
  return `${overall} Biggest move today: ${mover.name}, ${signedPct(mover.day_change_pct)}.`;
}
