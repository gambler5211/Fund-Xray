"""Fill stock_prices from NSE's daily bhavcopy, for the stocks in any tracked index and every stock anyone holds.

One file per trading day (~400 KB, every listed stock); only index constituents are kept.
Resumable like the index backfill: days already saved (judged by RELIANCE, which is in the
Nifty 50 throughout) are skipped. The nightly job calls this for the last few days.

--new-only downloads every day in the range again but writes only stocks with no price on the first
saved day of the range (a new holding, a new index member, a recent listing). Use it after someone buys a stock outside the indices:
Actions → NSE data → `holdings-prices` (about 20 minutes for 3 years).

    SUPABASE_SECRET_KEY=... python jobs/backfill_stock_prices.py --years 3
"""

from __future__ import annotations

import argparse
import time
from datetime import date, datetime, timedelta, timezone

from fund_xray_engine.nse import bhavcopy_url, parse_bhavcopy, weekdays

from common import db_select, db_select_all, db_upsert, fetch_text, log_run, nse_client, summary

ANCHOR = "RELIANCE"


HELD_DAYS = 45  # holdings snapshots this recent decide which held stocks to keep prices for


def constituent_symbols() -> set[str]:
    return {r["symbol"] for r in db_select_all("index_constituents", {"select": "symbol", "order": "symbol"})}


def nse_symbol_map() -> dict[str, str]:
    """ISIN -> NSE symbol, from NSE's own lists (industry_map)."""
    return {r["isin"]: r["symbol"] for r in db_select_all("industry_map", {"select": "isin,symbol", "order": "isin"})}


def nse_symbol(h: dict, by_isin: dict[str, str]) -> str | None:
    """The NSE symbol for a Kite holding. Kite reports many holdings under BSE (where they were bought);
    the ISIN finds the same company on NSE, and the Kite symbol is the fallback (usually identical)."""
    return by_isin.get(h.get("isin") or "") or h.get("symbol")


def held_symbols() -> set[str]:
    """NSE symbols for everything in anyone's recent holdings snapshots, whichever exchange Kite lists
    them under (read with the secret key, symbols only kept)."""
    since = (date.today() - timedelta(days=HELD_DAYS)).isoformat()
    by_isin = nse_symbol_map()
    out: set[str] = set()
    for r in db_select_all("holdings_snapshot", {"select": "holdings", "taken_at": f"gte.{since}", "order": "id"}):
        out |= {s for h in (r["holdings"] or []) if (s := nse_symbol(h, by_isin))}
    return out


def saved_symbols(on: str) -> set[str]:
    return {r["symbol"] for r in db_select_all("stock_prices", {"select": "symbol", "date": f"eq.{on}", "order": "symbol"})}


def backfill_stocks(start: date, end: date, pause: float = 0.7, progress: bool = True, refill: bool = False,
                    new_only: bool = False) -> dict:
    symbols = constituent_symbols() | held_symbols()
    if new_only:
        # A stock is "new" when it has no price on the first saved day of the range: the nightly run
        # may already have added its last few days, but not its history.
        first = db_select("stock_prices", {"select": "date", "symbol": f"eq.{ANCHOR}", "date": f"gte.{start.isoformat()}",
                                           "order": "date", "limit": "1"})
        symbols -= saved_symbols(first[0]["date"]) if first else set()
        refill = True
        summary(f"Stock prices, new stocks only: {len(symbols)} without saved prices"
                + (f" ({', '.join(sorted(symbols)[:12])}{'…' if len(symbols) > 12 else ''})" if symbols else ""))
        if not symbols:
            return {"saved": [], "no_file": [], "stocks": 0, "rows": 0}
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
    ap.add_argument("--new-only", action="store_true", help="write only stocks that have no saved prices yet")
    args = ap.parse_args()
    started = datetime.now(timezone.utc).isoformat()
    end = date.today()
    start = end - timedelta(days=int(args.years * 365.25) if args.years else (args.days or 10))
    try:
        res = backfill_stocks(start, end, args.pause, refill=args.refill, new_only=args.new_only)
    except Exception as e:
        log_run("stocks", started, "failed", f"Stock price backfill failed: {str(e)[:300]}")
        raise
    log_run("stocks", started, "ok", f"Saved {len(res['saved'])} trading days, {res['rows']} rows, from {start}",
            {"stocks": res["stocks"], "no_file": len(res["no_file"])})
