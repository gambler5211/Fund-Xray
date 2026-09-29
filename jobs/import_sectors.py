"""Load NSE's industry classification into industry_map.

1. NSE's index constituent lists: Nifty Total Market (Nifty 500 + Microcap 250) covers ~750
   companies in bulk.
2. For stocks people actually hold that aren't in those lists (smaller companies, SME, recent
   listings), NSE's quote page, one stock at a time. That also gives all four levels
   (macro, sector, industry, basic industry).
3. ETFs and index funds are marked "ETFs & funds".
Anything still missing shows as "Unmapped" in the app, where you pick a sector.

    SUPABASE_SECRET_KEY=... python jobs/import_sectors.py
"""

from __future__ import annotations

import time

from fund_xray_engine.nse import ARCHIVE, QUOTE_URL, looks_like_fund, parse_constituents, parse_quote_industry

from common import db_select, db_upsert, fetch_text, nse_client, summary

LISTS = [  # later lists never overwrite an ISIN an earlier list already classified
    ("niftytotalmarket", "Nifty Total Market"),
    ("niftymicrocap250", "Nifty Microcap 250"),
    ("niftysmeemerge", "Nifty SME Emerge"),
]

seen: dict[str, dict] = {}
with nse_client() as c:
    for slug, label in LISTS:
        try:
            text = fetch_text(c, f"{ARCHIVE}/ind_{slug}_list.csv")
        except RuntimeError as e:
            summary(f"- ⚠️ {label}: {e}")
            continue
        if text is None:
            summary(f"- {label}: list not published at this address, skipped")
            continue
        rows = parse_constituents(text)
        new = 0
        for r in rows:
            if r["isin"] not in seen:
                seen[r["isin"]] = {**r, "source": label}
                new += 1
        summary(f"- {label}: {len(rows)} companies, {new} new")

if not seen:
    raise SystemExit("No sector lists could be downloaded.")
batch = list(seen.values())
for i in range(0, len(batch), 500):
    db_upsert("industry_map", batch[i : i + 500], on_conflict="isin")
summary(f"Saved {len(batch)} companies from the index lists.")

# 2 + 3: everything held (in anyone's recent snapshot) that the lists didn't cover
held: dict[str, dict] = {}
for snap in db_select("holdings_snapshot", {"select": "holdings", "order": "taken_at.desc", "limit": "200"}):
    for h in snap.get("holdings") or []:
        if h.get("isin") and h["isin"] not in seen:
            held.setdefault(h["isin"], h)
if held:  # skip ones an earlier run already classified (keeps the weekly run short)
    done = db_select("industry_map", {"select": "isin", "isin": f"in.({','.join(held)})"})
    for r in done:
        held.pop(r["isin"], None)
summary(f"- {len(held)} held stocks aren't in the index lists; looking them up one by one")

funds, found, missing = [], [], []
with nse_client() as c:
    try:
        c.get("https://www.nseindia.com/", headers={"Accept": "text/html"})  # NSE sets the cookies its API wants
    except Exception as e:  # noqa: BLE001
        summary(f"- ⚠️ NSE home page didn't load ({type(e).__name__}); lookups may fail")
    for isin, h in held.items():
        symbol, name = h.get("symbol", ""), h.get("name", "")
        if looks_like_fund(symbol, name):
            funds.append({"isin": isin, "symbol": symbol, "company_name": name, "industry": "ETFs & funds", "source": "fund"})
            continue
        if h.get("exchange", "NSE") != "NSE":
            missing.append(symbol)
            continue
        try:
            r = c.get(QUOTE_URL.format(symbol=symbol), headers={"Accept": "application/json", "Referer": f"https://www.nseindia.com/get-quotes/equity?symbol={symbol}"})
            info = parse_quote_industry(r.json()) if r.status_code == 200 else None
        except Exception:  # noqa: BLE001
            info = None
        if info:
            found.append({"isin": isin, "symbol": symbol, "company_name": name, "source": "NSE quote", **info})
        else:
            missing.append(symbol)
        time.sleep(0.8)

EXTRA = {"macro": None, "industry_detail": None, "basic_industry": None}
rows = [{**EXTRA, **r} for r in funds + found]  # every row needs the same columns for a bulk upsert
if rows:
    db_upsert("industry_map", rows, on_conflict="isin")
summary(f"- NSE quote page: {len(found)} classified; {len(funds)} ETFs/funds marked")
if missing:
    summary(f"- Still unmapped (pick these in the app): {', '.join(sorted(missing))}")
