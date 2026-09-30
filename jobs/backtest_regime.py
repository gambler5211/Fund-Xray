"""Backtest the regime rule on the weeks saved in market_regime (Week 2, Day 7).

Reads only; writes nothing to the database. For every setting of the two cut-offs (how far the
cyclical group's Ratio must lead or trail the defensive group's, and how many Nifty 500 stocks must
be above their 50-day average for a Cyclical lead) it scores the label against what the two groups
did over the next 4 and 8 weeks. See engine/fund_xray_engine/backtest.py for the definitions.

Run from Actions → NSE data → `backtest`, or locally:

    SUPABASE_SECRET_KEY=... python jobs/backtest_regime.py --out docs/regime-backtest.md
"""

from __future__ import annotations

import argparse
from collections import Counter
from datetime import date
from pathlib import Path

from fund_xray_engine import backtest as bt
from fund_xray_engine import breadth as br

from common import db_select_all, summary
from compute_rotation import load_prices


def pct(v: float | None) -> str:
    return "–" if v is None else f"{v:.0f}%"


def pts(v: float | None) -> str:
    return "–" if v is None else f"{v:+.1f}".replace("-", "−")


def load_weeks() -> list[bt.Week]:
    rows = db_select_all("market_regime", {"select": "date,spread,market_breadth", "order": "date"})
    dates = [date.fromisoformat(r["date"]) for r in rows]
    keys = sorted(set(br.CYCLICAL) | set(br.DEFENSIVE))
    prices = load_prices(keys)
    fwd = bt.outcomes(dates, prices, br.CYCLICAL, br.DEFENSIVE)
    return [bt.Week(d, float(r["spread"]), None if r["market_breadth"] is None else float(r["market_breadth"]), fwd[d])
            for d, r in zip(dates, rows)]


def report(weeks: list[bt.Week]) -> list[str]:
    results = bt.grid(weeks)
    by = {(r.threshold, r.breadth_min, r.horizon): r for r in results}
    pick = bt.recommend(results)
    now = (br.REGIME_THRESHOLD, br.REGIME_BREADTH)

    lines = [f"## Regime backtest: {len(weeks)} weeks, {weeks[0].date:%-d %b %Y} to {weeks[-1].date:%-d %b %Y}", ""]
    lines.append("What the cyclical group (Bank, Auto, Metal, Realty, Infrastructure, PSE) did against the "
                 "defensive group (FMCG, Pharma, Healthcare) in the 4 and 8 weeks after each label.")
    lines.append("")
    base = ", ".join(f"{h} weeks: {pct(bt.base_rate(weeks, h))}" for h in bt.HORIZONS)
    lines.append(f"Base rate (cyclical beat defensive in all weeks): {base}. A hit rate only counts above that.")
    lines.append("")
    lines.append("| Threshold | Breadth above | Calls 4w | Hit 4w | Halves 4w | Edge 4w | Calls 8w | Hit 8w | Halves 8w | Edge 8w | Flip rate | |")
    lines.append("|---|---|---|---|---|---|---|---|---|---|---|---|")
    for t in bt.THRESHOLDS:
        for b in bt.BREADTHS:
            r4, r8 = by[(t, b, 4)], by[(t, b, 8)]
            mark = ("current " if (t, b) == now else "") + ("suggested" if (t, b) == pick else "")
            lines.append(f"| ±{t:g} | {'off' if b == 0 else f'{b:g}%'} | {r4.calls} | {pct(r4.hit_rate)} | "
                         f"{pct(r4.first_half)} / {pct(r4.second_half)} | {pts(r4.edge)} | "
                         f"{r8.calls} | {pct(r8.hit_rate)} | {pct(r8.first_half)} / {pct(r8.second_half)} | {pts(r8.edge)} | "
                         f"{100 * r4.flip_rate:.0f}% | {mark.strip()} |")
    lines.append("")
    lines.append("Calls = weeks labelled Cyclical or Defensive lead with a known outcome. Halves = hit rate in the "
                 "earlier / later half of history. Edge = average outcome after Cyclical lead minus after Defensive "
                 "lead, in points. Flip rate = label changes per week.")
    lines.append("")
    if pick:
        lines.append(f"Suggested by the selection rule (at least {bt.MIN_CALLS} calls at both horizons, flip rate at most "
                     f"{100 * bt.MAX_FLIP_RATE:.0f}%, 50% or better in both halves, then best average hit rate): "
                     f"threshold ±{pick[0]:g}, breadth {'off' if pick[1] == 0 else f'above {pick[1]:g}%'}.")
    else:
        lines.append("No setting passes the selection rule (enough calls, steady, 50% or better in both halves).")
    counts = Counter(br.classify(w.spread, w.market_breadth, *now) for w in weeks)
    lines.append("")
    lines.append("Weeks by label under the current rule: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())) + ".")
    return lines


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="also write the report to this file (markdown)")
    args = ap.parse_args()
    weeks = load_weeks()
    if len(weeks) < 30:
        summary(f"Backtest: only {len(weeks)} weeks of regime saved; run the `breadth` job first.")
        return
    lines = report(weeks)
    for line in lines:
        summary(line)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
