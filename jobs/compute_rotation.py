"""Fill rotation_scores from index_prices: every tracked index against each benchmark.

Scores only depend on earlier days, so the nightly run recomputes everything in memory (a second
or two) but writes only from two weeks before the last saved score onwards; with nothing saved
yet, it writes everything. --full writes all 3 years again (after changing n or k, or adding an
index).

    SUPABASE_SECRET_KEY=... python jobs/compute_rotation.py --full
"""

from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta, timezone

from fund_xray_engine import rotation as rot

from common import db_select, db_select_all, db_upsert, log_run, summary

BENCHMARKS = ("nifty-50", "nifty-500", "nifty-midcap-150", "nifty-smallcap-250")
OVERLAP_DAYS = 14  # rewrite this far back from the last saved score, so this week's week_end flag moves with it


def load_prices(keys: list[str]) -> dict[str, dict[date, float]]:
    out: dict[str, dict[date, float]] = {}
    for key in keys:
        rows = db_select_all("index_prices", {"select": "date,close", "index_key": f"eq.{key}", "order": "date"})
        out[key] = {date.fromisoformat(r["date"]): float(r["close"]) for r in rows}
    return out


def score_rows(prices: dict[str, dict[date, float]], keys: list[str], since: date | None,
               n: int = rot.DEFAULT_N, k: int = rot.DEFAULT_K) -> tuple[list[dict], dict]:
    """Rows for rotation_scores, plus counts for the summary."""
    rows: list[dict] = []
    stats = {"pairs": 0, "short": [], "latest": None}
    for bench in BENCHMARKS:
        if not prices.get(bench):
            continue
        for key in keys:
            if key == bench:
                continue
            daily = rot.scores(prices.get(key, {}), prices[bench], n, k)
            if not daily:
                if bench == "nifty-500":
                    stats["short"].append(key)
                continue
            stats["pairs"] += 1
            week_ends = {s.date for s in rot.weekly(daily)}
            for s in daily:
                if since and s.date < since:
                    continue
                rows.append({"index_key": key, "benchmark_key": bench, "date": s.date.isoformat(),
                             "rs": round(s.rs, 8), "ratio": round(s.ratio, 4), "momentum": round(s.momentum, 4),
                             "quadrant": s.quadrant, "settled_quadrant": s.settled,
                             "week_end": s.date in week_ends})
            last = daily[-1].date
            stats["latest"] = max(stats["latest"] or last, last)
    return rows, stats


def compute(full: bool = False) -> dict:
    keys = [t["key"] for t in db_select("tracked_indices", {"select": "key", "order": "sort"})]
    prices = load_prices(keys)
    since = None
    if not full:
        last = db_select("rotation_scores", {"select": "date", "benchmark_key": "eq.nifty-500", "order": "date.desc", "limit": "1"})
        since = date.fromisoformat(last[0]["date"]) - timedelta(days=OVERLAP_DAYS) if last else None
    rows, stats = score_rows(prices, keys, since)
    for i in range(0, len(rows), 1000):
        db_upsert("rotation_scores", rows[i:i + 1000], on_conflict="index_key,benchmark_key,date")
    stats["written"] = len(rows)
    latest = stats["latest"].strftime("%-d %b") if stats["latest"] else "–"
    summary(f"Rotation: {stats['pairs']} index–benchmark pairs, {len(rows)} rows written, up to {latest}.")
    if stats["short"]:
        summary(f"- Not enough history yet ({rot.min_history()} trading days needed): {', '.join(stats['short'])}")
    return stats


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--full", action="store_true", help="write all dates, not just the last few weeks")
    args = ap.parse_args()
    started = datetime.now(timezone.utc).isoformat()
    try:
        st = compute(args.full)
    except Exception as e:
        log_run("rotation", started, "failed", f"Rotation failed: {str(e)[:300]}")
        raise
    log_run("rotation", started, "ok", f"{st['written']} rows up to {st['latest']}", {"pairs": st["pairs"], "short": st["short"]})
