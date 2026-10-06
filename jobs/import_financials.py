"""Import company financials from NSE's results filings into company_financials (Week 3, Day 5).

For every stock anyone holds (or the symbols given), it reads NSE's two filing lists, picks one
filing per quarter since history_start() (consolidated when the company files it), and downloads
and parses each XBRL file it doesn't already have. Resumable: quarters already stored from the
same file are skipped, so a re-run only fetches what's new or revised. Files that can't be read are
noted in financials_skipped and not tried again.

About one second between downloads; roughly 15 files per company the first time, then one or two
a quarter. Run from Actions → NSE data → `financials` (also every Sunday with sectors).

    SUPABASE_SECRET_KEY=... python jobs/import_financials.py                 # everything held
    SUPABASE_SECRET_KEY=... python jobs/import_financials.py --symbols TCS INFY
"""

from __future__ import annotations

import argparse
import time
from datetime import date, datetime, timezone

from fund_xray_engine import financials as fin

from backfill_stock_prices import held_symbols
from common import db_insert, db_select_all, db_upsert, fetch_json, fetch_text, log_run, nse_api_client, summary

PAUSE = 1.0
PAGE = 50


def list_refs(client, symbol: str) -> list[fin.FilingRef]:
    """Both of NSE's lists for one company, read into FilingRefs."""
    old = fetch_json(client, fin.OLD_API.format(symbol=symbol))
    refs = fin.refs_from_old(old if isinstance(old, list) else [])
    page = 1
    while True:
        res = fetch_json(client, fin.INTEGRATED_API.format(symbol=symbol, page=page, size=PAGE))
        rows = res.get("data", []) if isinstance(res, dict) else []
        refs += fin.refs_from_integrated(rows)
        total = int(res.get("totalCount") or 0) if isinstance(res, dict) else 0
        if len(rows) < PAGE or page * PAGE >= total:
            return refs
        page += 1


def stored(symbol: str) -> dict[tuple[date, bool], str]:
    rows = db_select_all("company_financials", {"select": "period_end,consolidated,source_url", "symbol": f"eq.{symbol}", "order": "period_end"})
    return {(date.fromisoformat(r["period_end"]), r["consolidated"]): r["source_url"] for r in rows}


def skipped_urls() -> set[str]:
    return {r["source_url"] for r in db_select_all("financials_skipped", {"select": "source_url", "order": "source_url"})}


def row_for(symbol: str, ref: fin.FilingRef, f: fin.Filing) -> dict:
    return {
        "symbol": symbol, "period_end": ref.period_end.isoformat(), "consolidated": ref.consolidated, "kind": f.kind,
        "ytd_months": f.ytd_months, "eps_q": f.eps_q, "eps_ytd": f.eps_ytd, "shares": f.shares, "equity": f.equity,
        "ocf_ytd": f.ocf_ytd, "capex_ytd": f.capex_ytd, "revenue_q": f.revenue_q, "profit_q": f.profit_q,
        "filed_at": ref.filed, "source_url": ref.url, "imported_at": datetime.now(timezone.utc).isoformat(),
    }


def import_symbols(symbols: list[str], since: date, pause: float = PAUSE) -> dict:
    skip = skipped_urls()
    done = {"files": 0, "companies": 0, "no_filings": [], "failed": [], "unreadable": 0}
    with nse_api_client() as api, nse_api_client() as files:
        files.headers["Accept"] = "application/xml,text/xml,*/*"
        for i, symbol in enumerate(symbols, 1):
            try:
                refs = fin.choose_refs(list_refs(api, symbol), since)
            except RuntimeError as e:
                done["failed"].append(f"{symbol} ({e})")
                continue
            if not refs:
                done["no_filings"].append(symbol)
                continue
            have = stored(symbol)
            todo = [r for r in refs if have.get((r.period_end, r.consolidated)) != r.url and r.url not in skip]
            rows = []
            for ref in todo:
                time.sleep(pause)
                try:
                    text = fetch_text(files, ref.url)
                except RuntimeError as e:
                    done["failed"].append(f"{symbol} {ref.period_end:%b %Y} ({e})")
                    continue
                try:
                    f = fin.parse_filing(text or "")
                except fin.FilingError as e:
                    db_insert("financials_skipped", [{"source_url": ref.url, "symbol": symbol, "reason": str(e)[:300]}])
                    done["unreadable"] += 1
                    continue
                rows.append(row_for(symbol, ref, f))
            db_upsert("company_financials", rows, on_conflict="symbol,period_end,consolidated")
            done["files"] += len(rows)
            done["companies"] += 1
            print(f"[{i}/{len(symbols)}] {symbol}: {len(refs)} quarters listed, {len(rows)} new", flush=True)
    return done


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--symbols", nargs="*", help="NSE symbols; default: every stock anyone holds")
    args = ap.parse_args()
    started = datetime.now(timezone.utc).isoformat()
    since = fin.history_start(date.today())
    symbols = sorted(set(args.symbols) if args.symbols else held_symbols())
    try:
        res = import_symbols(symbols, since)
    except Exception as e:
        log_run("financials", started, "failed", f"Financials import failed: {str(e)[:300]}")
        raise
    line = f"Financials: {res['files']} filings stored for {res['companies']} companies (quarters from {since:%b %Y})"
    summary(line)
    if res["no_filings"]:
        summary(f"- No results filings on NSE for: {', '.join(res['no_filings'])} (ETFs, funds and BSE-only companies have none)")
    if res["unreadable"]:
        summary(f"- {res['unreadable']} files couldn't be read; see the financials_skipped table")
    if res["failed"]:
        summary(f"- Download failures ({len(res['failed'])}), re-run to retry: {'; '.join(res['failed'][:10])}")
    log_run("financials", started, "ok", line, {k: v for k, v in res.items() if k != "files"})


if __name__ == "__main__":
    main()
