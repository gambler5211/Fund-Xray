"""Fill stock_prices from NSE's daily bhavcopy, for the stocks in any tracked index.

One file per trading day (~400 KB, every listed stock); only index constituents are kept.
Resumable like the index backfill: days already saved (judged by RELIANCE, which is in the
Nifty 50 throughout) are skipped. The nightly job calls this for the last few days.

    SUPABASE_SECRET_KEY=... python jobs/backfill_stock_prices.py --years 3
"""

from __future__ import annotations

import argparse
import time
from datetime import date, datetime, timedelta, timezone

from fund_xray_engine.nse import bhavcopy_url, parse_bhavcopy, weekdays

from common import db_select, db_select_all, db_upsert, fetch_text, log_run, nse_client, summary

ANCHOR = "RELIANCE"


def constituent_symbols() -> set[str]:
    return {r["symbol"] for r in db_select_all("index_constituents", {"select": "symbol", "order": "symbol"})}


def backfill_stocks(start: date, end: date, pause: float = 0.7, progress: bool = True, refill: bool = False) -> dict:
    symbols = constituent_symbols()
    if not symbols:
        summary("Stock prices: no index constituents saved yet; run the `sectors` job first.")
        return {"saved": [], "no_file": [], "stocks": 0, "rows": 0}
    have = {r["date"] for r in db_select_all("stock_prices", {"select": "date", "symbol": f"eq.{ANCHOR}",
                                                               "date": f"gte.{start.isoformat()}", "order": "date"})}
    days = [d for d in weekdays(start, end) if refill or d.isoformat() not in have]
    summary(f"Stock prices {start} → {end}: {len(days)} weekdays to fetch ({len(have)} already saved), {len(symbols)} stocks.")

    saved, no_file, rows_written = [], [], 0
    with nse_client() as c:
        for i, d in enumerate(days, 1):
            text = fetch_text(c, bhavcopy_url(d))
            if text is None:
                no_file.append(d.isoformat())
            else:
                rows = parse_bhavcopy(text, symbols)
                for j in range(0, len(rows), 1000):
                    db_upsert("stock_prices", rows[j:j + 1000], on_conflict="symbol,date")
                rows_written += len(rows)
                saved.append(d.isoformat())
            if progress and i % 50 == 0:
                print(f"  {i}/{len(days)} ({d})", flush=True)
            time.sleep(pause)

    summary(f"Saved {len(saved)} trading days of stock prices ({rows_written} rows); {len(no_file)} weekdays had no file.")
    return {"saved": saved, "no_file": no_file, "stocks": len(symbols), "rows": rows_written}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", type=float, default=0)
    ap.add_argument("--days", type=int, default=0)
    ap.add_argument("--pause", type=float, default=0.7)
    ap.add_argument("--refill", action="store_true", help="download days already saved too (after new constituents)")
    args = ap.parse_args()
    started = datetime.now(timezone.utc).isoformat()
    end = date.today()
    start = end - timedelta(days=int(args.years * 365.25) if args.years else (args.days or 10))
    try:
        res = backfill_stocks(start, end, args.pause, refill=args.refill)
    except Exception as e:
        log_run("stocks", started, "failed", f"Stock price backfill failed: {str(e)[:300]}")
        raise
    log_run("stocks", started, "ok", f"Saved {len(res['saved'])} trading days, {res['rows']} rows, from {start}",
            {"stocks": res["stocks"], "no_file": len(res["no_file"])})
