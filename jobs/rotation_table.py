"""Print this week's rotation table from the real index_prices (Week 2, Day 1 check).

Reads only; writes nothing. Run from Actions → NSE data → `rotation`, or locally:

    SUPABASE_SECRET_KEY=... python jobs/rotation_table.py --benchmark nifty-500
"""

from __future__ import annotations

import argparse
from datetime import date, timedelta

from fund_xray_engine import rotation as rot

from common import db_select, summary

BENCHMARKS = ("nifty-50", "nifty-500", "nifty-midcap-150", "nifty-smallcap-250")


def load_prices(keys: list[str], since: date) -> dict[str, dict[date, float]]:
    out: dict[str, dict[date, float]] = {}
    for key in keys:  # one query per index keeps each under PostgREST's 1,000-row page
        rows = db_select("index_prices", {"select": "date,close", "index_key": f"eq.{key}",
                                          "date": f"gte.{since.isoformat()}", "order": "date", "limit": "1000"})
        out[key] = {date.fromisoformat(r["date"]): float(r["close"]) for r in rows}
    return out


def fmt(v: float | None, d: int = 1, signed: bool = False) -> str:
    if v is None:
        return "–"
    s = f"{abs(v):.{d}f}"
    return (("+" if v > 0 else "−" if v < 0 else "") + s) if signed else s


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--benchmark", default="nifty-500", choices=BENCHMARKS)
    ap.add_argument("--n", type=int, default=rot.DEFAULT_N)
    ap.add_argument("--k", type=int, default=rot.DEFAULT_K)
    args = ap.parse_args()

    tracked = db_select("tracked_indices", {"select": "key,label,kind", "order": "sort"})
    labels = {t["key"]: t["label"] for t in tracked}
    sectors = [t["key"] for t in tracked if t["kind"] != "broad"]
    prices = load_prices(sectors + [args.benchmark], date.today() - timedelta(days=400))

    rows = rot.table(prices, args.benchmark, sectors, args.n, args.k)
    as_of = max((r.as_of for r in rows if r.as_of), default=None)
    summary(f"### Rotation vs {labels.get(args.benchmark, args.benchmark)}, week ending {as_of or '–'} (n = {args.n}, k = {args.k})")
    summary("")
    summary("| Index | Quadrant | Ratio | Momentum | Ratio vs 4 weeks ago | Path over 8 weeks |")
    summary("| --- | --- | ---: | ---: | ---: | --- |")
    for r in rows:
        labels_ = [t.label for t in r.tail]
        path = " → ".join(q for i, q in enumerate(labels_) if i == 0 or q != labels_[i - 1]) if r.tail else (r.note or "")
        quad = (r.quadrant or "–") + (" (on the line)" if r.tail and r.note else "")
        summary(f"| {labels.get(r.key, r.key)} | {quad} | {fmt(r.ratio, 2)} | {fmt(r.momentum, 2)} | {fmt(r.ratio_change_4w, 2, True)} | {path} |")
    counts = {q: sum(r.quadrant == q for r in rows) for q in rot.QUADRANTS}
    summary("")
    summary("Counts: " + ", ".join(f"{q} {c}" for q, c in counts.items()))
    summary(f"Quadrants are the steady labels: a sector keeps its side of a line until it crosses by more than "
            f"{rot.NEUTRAL_BAND} points. \"On the line\" means it's within that band now.")


if __name__ == "__main__":
    main()
