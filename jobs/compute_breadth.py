"""Fill index_breadth and market_regime from stock_prices, index_prices and index_constituents.

Breadth for every tracked index each week (share of members above their 50-day average, share up
over 20 trading days, equal-weight vs index return and the narrow flag), then the regime for each
week from the cyclical and defensive groups' Ratios against the Nifty 500.

The nightly run writes from two weeks before the last saved week; --full writes all 3 years
(after the first fill, or after changing a threshold in the engine).

    SUPABASE_SECRET_KEY=... python jobs/compute_breadth.py --full
"""

from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fund_xray_engine import breadth as br
from fund_xray_engine import rotation as rot

from common import db_select, db_select_all, db_upsert, log_run, summary
from compute_rotation import load_prices

MARKET = "nifty-500"
OVERLAP_DAYS = 14
HISTORY_DAYS = 120  # calendar days of stock prices loaded before the first week written (50 + 20 trading days, with room)


def load_stocks(since: date | None) -> dict[str, dict[date, float]]:
    params = {"select": "symbol,date,close,prev_close", "order": "symbol,date"}
    if since:
        params["date"] = f"gte.{since.isoformat()}"
    days: dict[str, list[br.StockDay]] = defaultdict(list)
    for r in db_select_all("stock_prices", params):
        days[r["symbol"]].append(br.StockDay(date.fromisoformat(r["date"]), float(r["close"]),
                                             float(r["prev_close"]) if r["prev_close"] is not None else None))
    return {sym: br.adjusted(rows) for sym, rows in days.items()}


def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def signed(v: float) -> str:
    return f"{v:+.1f}".replace("-", "−")


def pct(v: float | None) -> str:
    return "–" if v is None else f"{v:.0f}%"


def compute(full: bool = False) -> dict:
    tracked = db_select("tracked_indices", {"select": "key,label", "order": "sort"})
    keys = [t["key"] for t in tracked]
    labels = {t["key"]: t["label"] for t in tracked}

    since = None
    if not full:
        last = db_select("index_breadth", {"select": "date", "index_key": f"eq.{MARKET}", "order": "date.desc", "limit": "1"})
        since = date.fromisoformat(last[0]["date"]) - timedelta(days=OVERLAP_DAYS) if last else None

    members: dict[str, list[str]] = defaultdict(list)
    for r in db_select_all("index_constituents", {"select": "index_key,symbol", "order": "index_key,symbol"}):
        members[r["index_key"]].append(r["symbol"])

    prices = load_prices(keys)
    calendar = sorted(prices.get(MARKET, {}))
    if not calendar:
        summary("Breadth: no Nifty 500 prices saved yet; run the `backfill` job first.")
        return {"weeks": 0, "latest": None, "regime": None}
    stocks = load_stocks(since - timedelta(days=HISTORY_DAYS) if since else None)
    on = [d for d in br.week_ends(calendar) if not since or d >= since]

    rows, by_week, missing = [], defaultdict(dict), []
    for key in keys:
        syms = members.get(key, [])
        series = {s: stocks[s] for s in syms if s in stocks}
        if not series:
            missing.append(key)
            continue
        for b in br.breadth(series, prices.get(key), on, calendar):
            by_week[b.date][key] = b
            rows.append({"index_key": key, "week_start": week_start(b.date).isoformat(), "date": b.date.isoformat(),
                         "members": b.members, "pct_above_avg": round(b.pct_above_avg, 2), "pct_up": round(b.pct_up, 2),
                         "ew_return": round(b.ew_return, 4),
                         "index_return": round(b.index_return, 4) if b.index_return is not None else None,
                         "spread": round(b.spread, 4) if b.spread is not None else None, "narrow": b.narrow})
    for i in range(0, len(rows), 1000):
        db_upsert("index_breadth", rows[i:i + 1000], on_conflict="index_key,week_start")

    # Regime: each group index's Ratio against the Nifty 500 on the week's last trading day.
    ratio_by_day: dict[str, dict[date, float]] = {}
    for key in set(br.CYCLICAL) | set(br.DEFENSIVE):
        ratio_by_day[key] = {s.date: s.ratio for s in rot.scores(prices.get(key, {}), prices[MARKET])}
    regimes = []
    for d in on:
        market = by_week.get(d, {}).get(MARKET)
        g = br.regime({k: v[d] for k, v in ratio_by_day.items() if d in v},
                      market.pct_above_avg if market else None, d)
        if g:
            regimes.append({"week_start": week_start(d).isoformat(), "date": d.isoformat(),
                            "cyclical": round(g.cyclical, 4), "defensive": round(g.defensive, 4),
                            "spread": round(g.spread, 4),
                            "market_breadth": round(g.market_breadth, 2) if g.market_breadth is not None else None,
                            "regime": g.regime, "threshold": br.REGIME_THRESHOLD, "breadth_min": br.REGIME_BREADTH})
    db_upsert("market_regime", regimes, on_conflict="week_start")

    latest = on[-1] if on else None
    now = regimes[-1] if regimes else None
    summary(f"Breadth: {len(rows)} index-weeks for {len({r['index_key'] for r in rows})} indices, "
            f"{len(regimes)} weeks of regime, up to {latest.strftime('%-d %b') if latest else '–'}.")
    if now:
        summary(f"- Regime this week: {now['regime']} (cyclical − defensive = {signed(now['spread'])}; "
                f"market breadth {pct(now['market_breadth'])} of Nifty 500 stocks above their 50-day average)")
    if latest and by_week.get(latest):
        narrow = [(labels.get(k, k), b.spread) for k, b in by_week[latest].items() if b.narrow]
        if narrow:
            summary("- Narrow moves this week: " + ", ".join(f"{n} ({signed(s)} pts vs equal weight)" for n, s in sorted(narrow)))
    if missing:
        summary(f"- No member prices for: {', '.join(labels.get(k, k) for k in missing)}")
    counts = defaultdict(int)
    for r in regimes:
        counts[r["regime"]] += 1
    if full and regimes:
        summary("- Weeks by regime: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))
    return {"weeks": len(regimes), "latest": latest, "regime": now["regime"] if now else None, "missing": missing}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--full", action="store_true", help="write all weeks, not just the last few")
    args = ap.parse_args()
    started = datetime.now(timezone.utc).isoformat()
    try:
        st = compute(args.full)
    except Exception as e:
        log_run("breadth", started, "failed", f"Breadth failed: {str(e)[:300]}")
        raise
    log_run("breadth", started, "ok", f"{st['weeks']} weeks up to {st['latest']}; regime {st['regime']}",
            {"missing": st.get("missing", [])})
