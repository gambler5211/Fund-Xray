"""Fill latest_indicators: RSI(14) for every stock anyone holds and every tracked index (Week 3, Day 4).

Stock closes are adjusted for splits and bonuses first (the same chain breadth uses), so a 1:2
split doesn't read as a crash. About 7 months of closes are loaded so Wilder's smoothing has
settled by the last day.

    SUPABASE_SECRET_KEY=... python jobs/compute_indicators.py
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fund_xray_engine import breadth as br
from fund_xray_engine import indicators as ind

from backfill_stock_prices import held_symbols
from common import db_select, db_select_all, db_upsert, log_run, summary

HISTORY_DAYS = 220


def compute() -> dict:
    since = date.today() - timedelta(days=HISTORY_DAYS)
    rows = []

    syms = sorted(held_symbols())
    days: dict[str, list[br.StockDay]] = defaultdict(list)
    for i in range(0, len(syms), 50):
        chunk = ",".join(f'"{s}"' for s in syms[i:i + 50])
        for r in db_select_all("stock_prices", {"select": "symbol,date,close,prev_close", "symbol": f"in.({chunk})",
                                                "date": f"gte.{since.isoformat()}", "order": "symbol,date"}):
            days[r["symbol"]].append(br.StockDay(date.fromisoformat(r["date"]), float(r["close"]),
                                                 float(r["prev_close"]) if r["prev_close"] is not None else None))
    for s, d in days.items():
        got = ind.latest_rsi(br.adjusted(d))
        if got:
            rows.append({"kind": "stock", "key": s, "date": got[0].isoformat(), "rsi14": round(got[1], 2)})
    stocks = len(rows)

    for t in db_select("tracked_indices", {"select": "key", "order": "sort"}):
        prices = {date.fromisoformat(r["date"]): float(r["close"])
                  for r in db_select_all("index_prices", {"select": "date,close", "index_key": f"eq.{t['key']}",
                                                          "date": f"gte.{since.isoformat()}", "order": "date"})}
        got = ind.latest_rsi(prices)
        if got:
            rows.append({"kind": "index", "key": t["key"], "date": got[0].isoformat(), "rsi14": round(got[1], 2)})

    db_upsert("latest_indicators", rows, on_conflict="kind,key")
    missing = sorted(set(syms) - set(days))
    summary(f"Indicators: RSI for {stocks} held stocks and {len(rows) - stocks} indices.")
    if missing:
        summary(f"- No saved prices for: {', '.join(missing[:15])}{'…' if len(missing) > 15 else ''} (run `holdings-prices`)")
    return {"stocks": stocks, "indices": len(rows) - stocks}


if __name__ == "__main__":
    started = datetime.now(timezone.utc).isoformat()
    try:
        st = compute()
    except Exception as e:
        log_run("indicators", started, "failed", f"Indicators failed: {str(e)[:300]}")
        raise
    log_run("indicators", started, "ok", f"RSI for {st['stocks']} stocks, {st['indices']} indices")
