"""Can this machine download NSE's files? Run first; nothing is written anywhere.

    python jobs/probe_nse.py
"""

from __future__ import annotations

import sys
from datetime import date, timedelta

from fund_xray_engine.nse import ARCHIVE, close_all_url, parse_close_all, parse_constituents

from common import fetch_text, nse_client, summary

ok = True
with nse_client() as c:
    # 1. Latest daily closing file (walk back over weekends and holidays)
    d = date.today()
    for _ in range(10):
        try:
            text = fetch_text(c, close_all_url(d))
        except RuntimeError as e:
            summary(f"- ❌ Daily index file blocked or failing: {e}")
            ok = False
            break
        if text:
            rows = parse_close_all(text)
            summary(f"- ✅ Daily index file for {d:%d %b %Y}: {len(rows)} indices (e.g. {rows[0]['name']} {rows[0]['close']})")
            break
        d -= timedelta(days=1)
    else:
        summary("- ❌ No daily index file found in the last 10 days")
        ok = False

    # 2. An old file, to prove the backfill can reach 3 years back
    old = date.today() - timedelta(days=3 * 365)
    for _ in range(7):
        try:
            text = fetch_text(c, close_all_url(old))
        except RuntimeError as e:
            summary(f"- ❌ Old daily file failing: {e}")
            ok = False
            break
        if text:
            summary(f"- ✅ Daily index file from {old:%d %b %Y} is still published")
            break
        old += timedelta(days=1)

    # 3. Sector list
    try:
        text = fetch_text(c, f"{ARCHIVE}/ind_niftytotalmarket_list.csv")
        rows = parse_constituents(text or "")
        summary(f"- {'✅' if rows else '❌'} Nifty Total Market constituents: {len(rows)} companies with a sector")
        ok = ok and bool(rows)
    except RuntimeError as e:
        summary(f"- ❌ Constituent list failing: {e}")
        ok = False

summary("NSE is reachable from here." if ok else "NSE refused at least one request from here; see above.")
sys.exit(0 if ok else 1)
