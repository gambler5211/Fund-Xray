"""Fill holdings_weekly, alignment_weekly and market_alignment (Week 3, Day 1).

For every user, the last holdings snapshot of each week becomes that week's holdings. Each
holding gets its sector (your own choice first, then NSE's) and the sector's index; against each
benchmark, the index's steady quadrant that week gives your money by quadrant. The same week's
Nifty 500 stocks, counted by their sector's quadrant, give the market's split.

The nightly run rewrites the last few weeks; --full rewrites every week (after the first merge).

    SUPABASE_SECRET_KEY=... python jobs/compute_alignment.py --full
"""

from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fund_xray_engine import alignment as al

from common import db_select_all, db_upsert, log_run, summary
from compute_rotation import BENCHMARKS

MARKET = "nifty-500"
RECENT_DAYS = 21


def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def quadrants_by_week(since: date | None) -> dict[tuple[str, date], tuple[date, dict[str, str]]]:
    """(benchmark, week_start) -> (the week's point date, {index_key: steady quadrant})."""
    params = {"select": "index_key,benchmark_key,date,quadrant,settled_quadrant", "week_end": "eq.true",
              "order": "benchmark_key,date,index_key"}
    if since:
        params["date"] = f"gte.{since.isoformat()}"
    out: dict[tuple[str, date], tuple[date, dict[str, str]]] = {}
    for r in db_select_all("rotation_scores", params):
        d = date.fromisoformat(r["date"])
        key = (r["benchmark_key"], week_start(d))
        _, qs = out.setdefault(key, (d, {}))
        qs[r["index_key"]] = r["settled_quadrant"] or r["quadrant"]
    return out


def compute(full: bool = False) -> dict:
    since = None if full else date.today() - timedelta(days=RECENT_DAYS)
    quads = quadrants_by_week(since - timedelta(days=14) if since else None)
    sector_index = {r["industry"]: r["index_key"] for r in db_select_all("sector_index_map", {"select": "industry,index_key", "order": "industry"})}

    # Holdings: the last snapshot of each week, per user.
    params = {"select": "user_id,taken_at,holdings", "order": "user_id,taken_at"}
    if since:
        params["taken_at"] = f"gte.{since.isoformat()}"
    last: dict[tuple[str, date], dict] = {}
    for r in db_select_all("holdings_snapshot", params):
        if not r["holdings"]:
            continue
        taken = datetime.fromisoformat(r["taken_at"].replace("Z", "+00:00"))
        last[(r["user_id"], week_start(taken.date()))] = r  # ordered by time, so the week's last wins

    maps = db_select_all("industry_map", {"select": "isin,symbol,industry", "order": "isin"})
    by_isin = {m["isin"]: m["industry"] for m in maps}
    by_symbol = {m["symbol"]: m["industry"] for m in maps}
    overrides: dict[str, dict[str, str]] = defaultdict(dict)
    for o in db_select_all("sector_overrides", {"select": "user_id,instrument,industry", "order": "user_id,instrument"}):
        overrides[o["user_id"]][o["instrument"]] = o["industry"]

    weekly_rows, align_rows = [], []
    for (user, ws), snap in sorted(last.items()):
        holdings = [al.Holding(x.get("exchange", "NSE"), x["symbol"], x.get("isin"), x.get("name", x["symbol"]), float(x["value"]))
                    for x in snap["holdings"] if float(x.get("value") or 0) > 0]
        placed = al.place(holdings, by_isin, by_symbol, overrides.get(user, {}), sector_index)
        weekly_rows.append({"user_id": user, "week_start": ws.isoformat(), "taken_at": snap["taken_at"],
                            "value": round(sum(p.value for p in placed), 2),
                            "holdings": [{"symbol": p.symbol, "name": p.name, "value": round(p.value, 2), "share": round(p.share, 4),
                                          "industry": p.industry, "index_key": p.index_key} for p in placed]})
        for bench in BENCHMARKS:
            now = quads.get((bench, ws))
            if not now:
                continue
            prev = quads.get((bench, ws - timedelta(days=7)))
            s = al.split(placed, now[1])
            still = al.split(placed, prev[1]) if prev else None
            align_rows.append({"user_id": user, "week_start": ws.isoformat(), "benchmark_key": bench, "date": now[0].isoformat(),
                               "q_leading": round(s.leading, 4), "q_improving": round(s.improving, 4),
                               "q_weakening": round(s.weakening, 4), "q_lagging": round(s.lagging, 4),
                               "unmapped": round(s.unmapped, 4), "gaining": round(s.gaining, 4), "losing": round(s.losing, 4),
                               "gaining_if_still": round(still.gaining, 4) if still else None})
    db_upsert("holdings_weekly", weekly_rows, on_conflict="user_id,week_start")
    for i in range(0, len(align_rows), 1000):
        db_upsert("alignment_weekly", align_rows[i:i + 1000], on_conflict="user_id,week_start,benchmark_key")

    # The market: Nifty 500 stocks by their sector's quadrant, each week and benchmark.
    members = [r["industry"] for r in db_select_all("index_constituents", {"select": "industry", "index_key": f"eq.{MARKET}", "order": "isin"})]
    market_rows = []
    for (bench, ws), (d, qs) in sorted(quads.items()):
        if since and ws < week_start(since):
            continue
        m = al.market_split(members, sector_index, qs)
        if m:
            n, s = m
            market_rows.append({"week_start": ws.isoformat(), "benchmark_key": bench, "date": d.isoformat(), "stocks": n,
                                "q_leading": round(s.leading, 4), "q_improving": round(s.improving, 4),
                                "q_weakening": round(s.weakening, 4), "q_lagging": round(s.lagging, 4),
                                "gaining": round(s.gaining, 4), "losing": round(s.losing, 4)})
    for i in range(0, len(market_rows), 1000):
        db_upsert("market_alignment", market_rows[i:i + 1000], on_conflict="week_start,benchmark_key")

    users = len({u for u, _ in last})
    summary(f"Alignment: {len(weekly_rows)} user-weeks of holdings for {users} user{'s' if users != 1 else ''}, "
            f"{len(align_rows)} alignment rows, {len(market_rows)} market rows.")
    latest = [r for r in market_rows if r["benchmark_key"] == MARKET]
    if latest:
        r = latest[-1]
        summary(f"- Market this week: {r['gaining']:.0f}% of {r['stocks']} Nifty 500 stocks are in gaining sectors (vs Nifty 500)")
    return {"user_weeks": len(weekly_rows), "rows": len(align_rows), "market": len(market_rows)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--full", action="store_true", help="rewrite every week, not just the last few")
    args = ap.parse_args()
    started = datetime.now(timezone.utc).isoformat()
    try:
        st = compute(args.full)
    except Exception as e:
        log_run("alignment", started, "failed", f"Alignment failed: {str(e)[:300]}")
        raise
    log_run("alignment", started, "ok", f"{st['user_weeks']} user-weeks, {st['rows']} alignment rows, {st['market']} market rows")
