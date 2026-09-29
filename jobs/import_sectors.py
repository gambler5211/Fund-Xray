"""Load NSE's industry classification into industry_map, from NSE's index constituent lists.

Between them, Nifty Total Market (Nifty 500 + Microcap 250) and the SME Emerge list cover most
listed companies. Anything still missing shows as "Unmapped" in the app, where you pick a sector.

    SUPABASE_SECRET_KEY=... python jobs/import_sectors.py
"""

from __future__ import annotations

from fund_xray_engine.nse import ARCHIVE, parse_constituents

from common import db_upsert, fetch_text, nse_client, summary

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
summary(f"Saved {len(batch)} companies to industry_map.")
