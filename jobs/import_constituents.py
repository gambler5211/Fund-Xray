"""Refresh index_constituents: which stocks make up each tracked index.

Each index's list URL is in tracked_indices.constituents_url (NSE's archive, or niftyindices.com
for five newer indices). Runs with the weekly `sectors` job; NSE rebalances twice a year.
Stocks that leave an index are removed; a list that fails to download leaves the old members.

    SUPABASE_SECRET_KEY=... python jobs/import_constituents.py
"""

from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import urlparse

from fund_xray_engine.nse import parse_constituents

from common import db_delete, db_select, db_upsert, fetch_text, log_run, nse_client, summary


def import_constituents() -> dict:
    tracked = db_select("tracked_indices", {"select": "key,label,constituents_url", "order": "sort"})
    done, failed, members = [], [], set()
    with nse_client() as c:
        for t in tracked:
            url = t.get("constituents_url")
            if not url:
                failed.append(f"{t['label']} (no list address)")
                continue
            host = urlparse(url).netloc
            c.headers["Referer"] = "https://www.nseindia.com/" if host.endswith("nseindia.com") else f"https://{host}/"
            try:
                rows = parse_constituents(fetch_text(c, url) or "")
            except RuntimeError as e:
                failed.append(f"{t['label']} ({e})")
                continue
            if not rows:
                failed.append(f"{t['label']} (empty or not found)")
                continue
            now = datetime.now(timezone.utc).isoformat()
            db_upsert("index_constituents", [{"index_key": t["key"], "isin": r["isin"], "symbol": r["symbol"],
                                              "company_name": r["company_name"], "industry": r["industry"], "updated_at": now}
                                             for r in rows], on_conflict="index_key,isin")
            db_delete("index_constituents", {"index_key": f"eq.{t['key']}", "updated_at": f"lt.{now}"})  # left the index
            done.append((t["label"], len(rows)))
            members |= {r["symbol"] for r in rows}
    summary(f"Constituents: {len(done)} of {len(tracked)} indices refreshed, {len(members)} different stocks.")
    if failed:
        summary(f"- ⚠️ Not refreshed (kept last week's members): {', '.join(failed)}")
    return {"indices": len(done), "stocks": len(members), "failed": failed}


if __name__ == "__main__":
    started = datetime.now(timezone.utc).isoformat()
    res = import_constituents()
    log_run("constituents", started, "ok" if res["indices"] else "failed",
            f"{res['indices']} indices, {res['stocks']} stocks" + (f"; {len(res['failed'])} not refreshed" if res["failed"] else ""),
            {"failed": res["failed"]})
    if not res["indices"]:
        raise SystemExit("No constituent list could be downloaded.")
