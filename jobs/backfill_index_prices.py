"""Fill index_prices from NSE's daily closing files: one file per trading day, every index in it.

Resumable: days already saved are skipped, so it's safe to re-run, and the same script fills the
last few days each night (Day 7).

    SUPABASE_SECRET_KEY=... python jobs/backfill_index_prices.py --years 3
    SUPABASE_SECRET_KEY=... python jobs/backfill_index_prices.py --days 10
"""

from __future__ import annotations

import argparse
import time
from datetime import date, timedelta

from fund_xray_engine.nse import close_all_url, norm, parse_close_all, weekdays

from common import db_select, db_upsert, fetch_text, nse_client, summary

ap = argparse.ArgumentParser()
ap.add_argument("--years", type=float, default=0)
ap.add_argument("--days", type=int, default=0)
ap.add_argument("--pause", type=float, default=0.7, help="seconds between downloads, to be polite")
args = ap.parse_args()

end = date.today()
start = end - timedelta(days=int(args.years * 365.25) if args.years else (args.days or 10))

tracked = db_select("tracked_indices", {"select": "key,nse_name"})
by_name = {norm(t["nse_name"]): t["key"] for t in tracked}
anchor = "nifty-50"
have = {r["date"] for r in db_select("index_prices", {"select": "date", "index_key": f"eq.{anchor}", "date": f"gte.{start.isoformat()}", "limit": "5000"})}

days = [d for d in weekdays(start, end) if d.isoformat() not in have]
summary(f"Backfill {start} → {end}: {len(days)} weekdays to fetch ({len(have)} already saved), {len(tracked)} indices tracked.")

saved = holidays = 0
missing_names: set[str] = set(by_name)
with nse_client() as c:
    for i, d in enumerate(days, 1):
        text = fetch_text(c, close_all_url(d))
        if text is None:
            holidays += 1
        else:
            rows = parse_close_all(text)
            out = []
            for r in rows:
                key = by_name.get(norm(r["name"]))
                if key:
                    missing_names.discard(norm(r["name"]))
                    out.append({"index_key": key, "date": r["date"], "open": r["open"], "high": r["high"], "low": r["low"],
                                "close": r["close"], "pe": r["pe"], "pb": r["pb"], "div_yield": r["div_yield"]})
            db_upsert("index_prices", out, on_conflict="index_key,date")
            saved += 1
        if i % 50 == 0:
            print(f"  {i}/{len(days)} ({d})", flush=True)
        time.sleep(args.pause)

summary(f"Saved {saved} trading days; {holidays} weekdays had no file (market holidays).")
if missing_names and saved:
    summary(f"- ⚠️ Never found in NSE's files (check the name in tracked_indices): {', '.join(sorted(missing_names))}")
