"""The three valuation views for every held stock, for accounts with 'valuation' access only
(Week 3, Day 6). Runs in the nightly job after prices, and after each financials import.

For each such account: its newest holdings snapshot, each holding's NSE symbol (by ISIN) and
sector, the stored results filings and 3 years of NSE closes, and the account's own discount rate
and terminal growth from Settings. One row per held stock goes to valuation_views; rows for stocks
no longer held are removed. Holdings with no results filings (ETFs, funds) get no row.

Other accounts get nothing written at all, so there is nothing for them to read.

    SUPABASE_SECRET_KEY=... python jobs/compute_valuations.py
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fund_xray_engine import breadth as br
from fund_xray_engine import financials as fin
from fund_xray_engine import valuation as val

from backfill_stock_prices import nse_symbol, nse_symbol_map
from common import db_delete, db_select, db_select_all, db_upsert, log_run, summary

PRICE_DAYS = 3 * 366 + 14


def allowed_users() -> list[str]:
    return [r["user_id"] for r in db_select_all("feature_access", {"select": "user_id", "feature": "eq.valuation", "order": "user_id"})]


def latest_snapshot(user_id: str) -> dict | None:
    rows = db_select("holdings_snapshot", {"select": "taken_at,holdings", "user_id": f"eq.{user_id}", "order": "taken_at.desc", "limit": "1"})
    return rows[0] if rows and rows[0]["holdings"] else None


def user_rates(user_id: str) -> tuple[float, float]:
    rows = db_select("settings", {"select": "valuation_discount_pct,valuation_terminal_pct", "user_id": f"eq.{user_id}"})
    if not rows:
        return val.DEFAULT_DISCOUNT, val.DEFAULT_TERMINAL
    r = rows[0]
    return float(r.get("valuation_discount_pct") or 12) / 100, float(r.get("valuation_terminal_pct") or 5) / 100


def chunks(items: list[str], n: int = 50):
    for i in range(0, len(items), n):
        yield ",".join(f'"{s}"' for s in items[i:i + n])


def load_days(symbols: list[str], since: date) -> dict[str, list[br.StockDay]]:
    out: dict[str, list[br.StockDay]] = defaultdict(list)
    for chunk in chunks(symbols):
        for r in db_select_all("stock_prices", {"select": "symbol,date,close,prev_close", "symbol": f"in.({chunk})",
                                                "date": f"gte.{since.isoformat()}", "order": "symbol,date"}):
            out[r["symbol"]].append(br.StockDay(date.fromisoformat(r["date"]), float(r["close"]),
                                                float(r["prev_close"]) if r["prev_close"] is not None else None))
    return out


def load_financials(symbols: list[str]) -> dict[str, list[fin.Row]]:
    raw: dict[str, list[dict]] = defaultdict(list)
    for chunk in chunks(symbols):
        for r in db_select_all("company_financials", {"select": "*", "symbol": f"in.({chunk})", "order": "symbol,period_end"}):
            raw[r["symbol"]].append(r)
    return {s: fin.to_rows(v) for s, v in raw.items()}


def sector_by_isin(isins: list[str]) -> dict[str, str]:
    out = {}
    for chunk in chunks(isins):
        for r in db_select_all("industry_map", {"select": "isin,industry", "isin": f"in.({chunk})", "order": "isin"}):
            out[r["isin"]] = r["industry"]
    return out


def view_row(user_id: str, symbol: str, v: dict) -> dict:
    return {
        "user_id": user_id, "symbol": symbol, "computed_at": datetime.now(timezone.utc).isoformat(),
        "price": v.get("price"), "price_date": v.get("price_date"), "basis": v.get("basis"),
        "financial": bool(v.get("financial")),
        "pe": v.get("pe") or {}, "graham": v.get("graham") or {}, "reverse_dcf": v.get("reverse_dcf") or {},
        "past_growth": v.get("past_growth") or {},
        "sources": v.get("sources") or [],
    }


def compute() -> dict:
    users = allowed_users()
    if not users:
        summary("Valuation: no accounts have access; nothing written.")
        return {"users": 0, "stocks": 0}
    by_isin = nse_symbol_map()
    since = date.today() - timedelta(days=PRICE_DAYS)
    total, written_users = 0, 0
    for uid in users:
        snap = latest_snapshot(uid)
        if not snap:
            continue
        held = {}
        for h in snap["holdings"]:
            s = nse_symbol(h, by_isin)
            if s:
                held[s] = h.get("isin")
        symbols = sorted(held)
        fins = load_financials(symbols)
        with_filings = [s for s in symbols if fins.get(s)]
        days = load_days(with_filings, since)
        sectors = sector_by_isin([i for i in held.values() if i])
        r, tg = user_rates(uid)
        rows = [view_row(uid, s, val.views(days.get(s, []), fins[s], sectors.get(held[s] or ""), r, tg)) for s in with_filings]
        db_upsert("valuation_views", rows, on_conflict="user_id,symbol")
        if with_filings:
            db_delete("valuation_views", {"user_id": f"eq.{uid}", "symbol": f"not.in.({','.join(chr(34) + s + chr(34) for s in with_filings)})"})
        else:
            db_delete("valuation_views", {"user_id": f"eq.{uid}"})
        total += len(rows)
        written_users += 1
        missing = [s for s in symbols if s not in fins]
        summary(f"Valuation: {len(rows)} stocks for one account (discount {r:.0%}, terminal {tg:.0%})"
                + (f"; no filings stored for {len(missing)}: {', '.join(missing[:12])}{'…' if len(missing) > 12 else ''}" if missing else ""))
    return {"users": written_users, "stocks": total}


if __name__ == "__main__":
    started = datetime.now(timezone.utc).isoformat()
    try:
        res = compute()
    except Exception as e:
        log_run("valuations", started, "failed", f"Valuations failed: {str(e)[:300]}")
        raise
    log_run("valuations", started, "ok", f"Valuation views for {res['stocks']} stocks", res)
