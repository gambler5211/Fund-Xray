"""The nightly run (GitHub Actions, about 7 PM IST on weekdays): add the day's index closes.

It looks back 10 days rather than just today, so a night that failed, or a file NSE published
late, is picked up by the next run without anyone re-running anything. Each run is logged to
job_runs, which the app's footer reads ("Market data: 30 Sep close").

    SUPABASE_SECRET_KEY=... python jobs/nightly.py
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from backfill_index_prices import ANCHOR, backfill
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
    if res["missing_indices"]:
        line += f"; {len(res['missing_indices'])} tracked indices missing from NSE's file"
    summary(line)
    log_run("nightly", started, "ok", line, {"added": added, "no_file": res["no_file"], "latest_date": latest_date,
                                             "missing_indices": res["missing_indices"]})


if __name__ == "__main__":
    main()
