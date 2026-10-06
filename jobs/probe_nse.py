"""Can this machine download NSE's files? Run first; nothing is written anywhere.

    python jobs/probe_nse.py
"""

from __future__ import annotations

import sys
from datetime import date, timedelta

from fund_xray_engine.nse import ARCHIVE, bhavcopy_url, close_all_url, parse_bhavcopy, parse_close_all, parse_constituents

from fund_xray_engine import financials as fin

from common import fetch_json, fetch_text, nse_api_client, nse_client, summary

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

    # 4. Daily stock prices (bhavcopy), latest and 3 years back
    for label, start in (("latest", date.today()), ("3 years ago", date.today() - timedelta(days=3 * 365))):
        d, step = start, (-1 if label == "latest" else 1)
        for _ in range(10):
            try:
                text = fetch_text(c, bhavcopy_url(d))
            except RuntimeError as e:
                summary(f"- ❌ Stock price file ({label}) failing: {e}")
                ok = False
                break
            if text:
                rows = parse_bhavcopy(text)
                summary(f"- {'✅' if rows else '❌'} Stock price file for {d:%d %b %Y}: {len(rows)} stocks")
                ok = ok and bool(rows)
                break
            d += timedelta(days=step)
        else:
            summary(f"- ❌ No stock price file found ({label})")
            ok = False

    # 5. A constituent list that only niftyindices.com publishes
    try:
        c.headers["Referer"] = "https://www.niftyindices.com/"
        text = fetch_text(c, "https://www.niftyindices.com/IndexConstituent/ind_niftyPower_list.csv")
        rows = parse_constituents(text or "")
        summary(f"- {'✅' if rows else '❌'} niftyindices.com constituent list (Nifty Power): {len(rows)} companies")
        ok = ok and bool(rows)
    except RuntimeError as e:
        summary(f"- ❌ niftyindices.com failing: {e}")
        ok = False

# 6. Results filings (Week 3, Day 5): both lists for one company, and one XBRL file from each
try:
    with nse_api_client() as api:
        old = fin.refs_from_old(fetch_json(api, fin.OLD_API.format(symbol="TCS")))
        res = fetch_json(api, fin.INTEGRATED_API.format(symbol="TCS", page=1, size=50))
        new = fin.refs_from_integrated(res.get("data", []) if isinstance(res, dict) else [])
        since = fin.history_start(date.today())
        summary(f"- {'✅' if old else '❌'} Older results list (to Dec 2024): {len(old)} filings for TCS"
                f"{f', back to {min(r.period_end for r in old):%b %Y}' if old else ''}")
        summary(f"- {'✅' if new else '❌'} Integrated Filing list (2025 on): {len(new)} filings for TCS"
                f"{f', latest {max(r.period_end for r in new):%b %Y}' if new else ''}")
        ok = ok and bool(old) and bool(new)
        picks = fin.choose_refs(old + new, since)
        api.headers["Accept"] = "application/xml,text/xml,*/*"
        for label, ref in (("oldest needed", picks[0] if picks else None), ("latest", picks[-1] if picks else None)):
            if ref is None:
                continue
            f = fin.parse_filing(fetch_text(api, ref.url) or "")
            summary(f"- ✅ XBRL for {ref.period_end:%b %Y} ({label}): EPS ₹{f.eps_q}, {f.shares or 0:,.0f} shares"
                    f"{f', operating cash flow ₹{f.ocf_ytd / 1e7:,.0f} cr' if f.ocf_ytd else ''}")
        summary(f"- Import window: quarters from {since:%b %Y}; {len(picks)} quarters to fetch for TCS")
except (RuntimeError, fin.FilingError) as e:
    summary(f"- ❌ Results filings failing: {e}")
    ok = False

summary("NSE is reachable from here." if ok else "NSE refused at least one request from here; see above.")
sys.exit(0 if ok else 1)
