"""Fill index_prices from NSE's daily closing files: one file per trading day, every index in it.

Resumable: days already saved are skipped, so it's safe to re-run. The nightly job (nightly.py)
calls the same code for the last few days.

    SUPABASE_SECRET_KEY=... python jobs/backfill_index_prices.py --years 3
    SUPABASE_SECRET_KEY=... python jobs/backfill_index_prices.py --days 10
"""

from __future__ import annotations

import argparse
import time
from datetime import date, datetime, timedelta, timezone

from fund_xray_engine.nse import close_all_url, norm, parse_close_all, weekdays

from common import db_select, db_upsert, fetch_text, log_run, nse_client, summary

ANCHOR = "nifty-50"  # every daily file has it, so its dates are the days we have


def backfill(start: date, end: date, pause: float = 0.7, progress: bool = True, refill: bool = False) -> dict:
    """Download and save every weekday in [start, end] not saved yet. Returns counts for the summary.

    refill=True downloads every day again, even ones already saved: use it after adding indices to
    tracked_indices, since "saved" is judged by the Nifty 50 row and the new indices have none."""
    tracked = db_select("tracked_indices", {"select": "key,nse_name"})
    by_name = {norm(t["nse_name"]): t["key"] for t in tracked}
    have = {r["date"] for r in db_select("index_prices", {"select": "date", "index_key": f"eq.{ANCHOR}",
                                                          "date": f"gte.{start.isoformat()}", "limit": "5000"})}
    days = [d for d in weekdays(start, end) if refill or d.isoformat() not in have]
    summary(f"Index prices {start} → {end}: {len(days)} weekdays to fetch ({len(have)} already saved), {len(tracked)} indices tracked.")

    saved: list[str] = []
    no_file: list[str] = []
    missing_names: set[str] = set(by_name)
    with nse_client() as c:
        for i, d in enumerate(days, 1):
            text = fetch_text(c, close_all_url(d))
            if text is None:
                no_file.append(d.isoformat())
            else:
                out = []
                for r in parse_close_all(text):
                    key = by_name.get(norm(r["name"]))
                    if key:
                        missing_names.discard(norm(r["name"]))
                        out.append({"index_key": key, "date": r["date"], "open": r["open"], "high": r["high"], "low": r["low"],
                                    "close": r["close"], "pe": r["pe"], "pb": r["pb"], "div_yield": r["div_yield"]})
                db_upsert("index_prices", out, on_conflict="index_key,date")
                saved.append(d.isoformat())
            if progress and i % 50 == 0:
                print(f"  {i}/{len(days)} ({d})", flush=True)
            time.sleep(pause)

    summary(f"Saved {len(saved)} trading days; {len(no_file)} weekdays had no file (market holidays, or not published yet).")
    if missing_names and saved:
        summary(f"- ⚠️ Never found in NSE's files (check the name in tracked_indices): {', '.join(sorted(missing_names))}")
    return {"saved": saved, "no_file": no_file, "missing_indices": sorted(missing_names) if saved else [], "tracked": len(tracked)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", type=float, default=0)
    ap.add_argument("--days", type=int, default=0)
    ap.add_argument("--pause", type=float, default=0.7, help="seconds between downloads, to be polite")
    ap.add_argument("--refill", action="store_true", help="download days already saved too (after adding indices)")
    args = ap.parse_args()

    started = datetime.now(timezone.utc).isoformat()
    end = date.today()
    start = end - timedelta(days=int(args.years * 365.25) if args.years else (args.days or 10))
    try:
        res = backfill(start, end, args.pause, refill=args.refill)
    except Exception as e:
        log_run("backfill", started, "failed", f"Backfill failed: {e}")
        raise
    log_run("backfill", started, "ok", f"Saved {len(res['saved'])} trading days from {start}", {"saved": len(res["saved"]), "no_file": len(res["no_file"])})
