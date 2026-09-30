"""The nightly run (GitHub Actions, about 7 PM IST on weekdays): add the day's index closes and
constituent stock prices, then bring rotation_scores, index_breadth and market_regime up to date.

It looks back 10 days rather than just today, so a night that failed, or a file NSE published
late, is picked up by the next run without anyone re-running anything. Each run is logged to
job_runs, which the app's footer reads ("Market data: 30 Sep close").

    SUPABASE_SECRET_KEY=... python jobs/nightly.py
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from backfill_index_prices import ANCHOR, backfill
from backfill_stock_prices import backfill_stocks
from compute_breadth import compute as compute_breadth
from compute_rotation import compute as compute_rotation
from common import db_select, log_run, summary

LOOKBACK_DAYS = 10


def short(d: str) -> str:
    return datetime.fromisoformat(d).strftime("%-d %b")


def main() -> None:
    started = datetime.now(timezone.utc).isoformat()
    today = date.today()  # the runner's clock is UTC; 7 PM IST is still the same date
    try:
        res = backfill(today - timedelta(days=LOOKBACK_DAYS), today, pause=0.7, progress=False)
        latest = db_select("index_prices", {"select": "date", "index_key": f"eq.{ANCHOR}", "order": "date.desc", "limit": "1"})
        latest_date = latest[0]["date"] if latest else None
        stocks = backfill_stocks(today - timedelta(days=LOOKBACK_DAYS), today, pause=0.7, progress=False)
        rotation = compute_rotation(full=False)
        breadth = compute_breadth(full=False)
    except Exception as e:
        log_run("nightly", started, "failed", f"Nightly run failed: {str(e)[:300]}")
        raise

    added = res["saved"]
    if added:
        line = f"Added {len(added)} trading day{'s' if len(added) != 1 else ''} (latest {short(latest_date)})"
    elif today.weekday() < 5 and today.isoformat() in res["no_file"]:
        line = f"No file for {short(today.isoformat())} yet (holiday, or NSE hasn't published it); latest is {short(latest_date)}" if latest_date else "No data yet"
    else:
        line = f"Nothing new; latest is {short(latest_date)}" if latest_date else "No data yet"
    if stocks["saved"]:
        line += f"; stock prices for {len(stocks['saved'])} day{'s' if len(stocks['saved']) != 1 else ''}"
    if rotation.get("latest"):
        line += f"; rotation to {rotation['latest'].strftime('%-d %b')}"
    if breadth.get("regime"):
        line += f"; regime {breadth['regime']}"
    if res["missing_indices"]:
        line += f"; {len(res['missing_indices'])} tracked indices missing from NSE's file"
    summary(line)
    log_run("nightly", started, "ok", line, {"added": added, "no_file": res["no_file"], "latest_date": latest_date,
                                             "missing_indices": res["missing_indices"], "stock_days": len(stocks["saved"]),
                                             "rotation_latest": rotation["latest"].isoformat() if rotation.get("latest") else None,
                                             "regime": breadth.get("regime")})


if __name__ == "__main__":
    main()
