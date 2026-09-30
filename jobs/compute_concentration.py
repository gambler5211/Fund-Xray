"""Fill portfolio_concentration from each user's latest holdings snapshot and stock_prices (Week 3, Day 2).

For every user: effective holdings, the clusters of holdings whose weekly returns moved together
over the last year (correlation above 0.6), effective bets, and the holdings left out for lack of
price history. Prices are adjusted for splits and bonuses the same way breadth does.

    SUPABASE_SECRET_KEY=... python jobs/compute_concentration.py
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fund_xray_engine import breadth as br
from fund_xray_engine import concentration as cc

from common import db_select, db_select_all, db_upsert, log_run, summary

WINDOW_DAYS = 380  # a year of weeks plus the week before the first return


def latest_snapshots() -> dict[str, dict]:
    """Each user's newest snapshot (users with none are skipped)."""
    out: dict[str, dict] = {}
    since = (date.today() - timedelta(days=60)).isoformat()
    for r in db_select_all("holdings_snapshot", {"select": "user_id,taken_at,holdings", "taken_at": f"gte.{since}",
                                                 "order": "user_id,taken_at"}):
        if r["holdings"]:
            out[r["user_id"]] = r  # ordered by time: the last one wins
    return out


def load_prices(symbols: set[str], since: date) -> dict[str, dict[date, float]]:
    days: dict[str, list[br.StockDay]] = defaultdict(list)
    syms = sorted(symbols)
    for i in range(0, len(syms), 50):  # keep each URL short
        chunk = ",".join(f'"{s}"' for s in syms[i:i + 50])
        for r in db_select_all("stock_prices", {"select": "symbol,date,close,prev_close", "symbol": f"in.({chunk})",
                                                "date": f"gte.{since.isoformat()}", "order": "symbol,date"}):
            days[r["symbol"]].append(br.StockDay(date.fromisoformat(r["date"]), float(r["close"]),
                                                 float(r["prev_close"]) if r["prev_close"] is not None else None))
    return {s: br.adjusted(v) for s, v in days.items()}


def iso_weeks(start: date, end: date) -> list[tuple[int, int]]:
    out, d = [], start - timedelta(days=start.weekday())
    while d <= end:
        out.append(tuple(d.isocalendar()[:2]))
        d += timedelta(days=7)
    return out


def compute() -> dict:
    snaps = latest_snapshots()
    if not snaps:
        summary("Concentration: no holdings snapshots in the last 60 days.")
        return {"users": 0}
    latest = db_select("stock_prices", {"select": "date", "symbol": "eq.RELIANCE", "order": "date.desc", "limit": "1"})
    end = date.fromisoformat(latest[0]["date"]) if latest else date.today()
    since = end - timedelta(days=WINDOW_DAYS)
    weeks = iso_weeks(since, end)[-(cc.CORRELATION_WEEKS + 1):]

    wanted = {h["symbol"] for s in snaps.values() for h in s["holdings"] if h.get("symbol")}
    prices = load_prices(wanted, since)

    rows, notes = [], []
    for user, snap in snaps.items():
        by_symbol: dict[str, dict] = {}
        for h in snap["holdings"]:
            v = float(h.get("value") or 0)
            if v > 0:
                cur = by_symbol.setdefault(h["symbol"], {"name": h.get("name", h["symbol"]), "value": 0.0})
                cur["value"] += v
        total = sum(x["value"] for x in by_symbol.values())
        if not total:
            continue
        shares = {s: 100 * x["value"] / total for s, x in by_symbol.items()}
        c = cc.concentration(shares, prices, weeks)
        name = lambda s: by_symbol[s]["name"]  # noqa: E731
        rows.append({"user_id": user, "snapshot_at": snap["taken_at"], "prices_to": end.isoformat(), "holdings": c.holdings,
                     "effective_holdings": round(c.effective_holdings, 3), "effective_bets": round(c.effective_bets, 3),
                     "clusters": [{"symbols": list(g.symbols), "names": [name(s) for s in g.symbols], "share": round(g.share, 4),
                                   "correlation": round(g.correlation, 3) if g.correlation is not None else None} for g in c.clusters],
                     "left_out": [{"symbol": s, "name": name(s), "share": round(shares[s], 4)} for s in c.left_out],
                     "weeks": c.weeks, "cut": cc.CLUSTER_CORRELATION,
                     "computed_at": datetime.now(timezone.utc).isoformat()})
        multi = [g for g in c.clusters if len(g.symbols) > 1]
        notes.append(f"{c.holdings} holdings → {c.effective_holdings:.1f} effective, {c.effective_bets:.1f} bets; "
                     f"{len(multi)} multi-stock clusters; {len(c.left_out)} left out")
    db_upsert("portfolio_concentration", rows, on_conflict="user_id")
    summary(f"Concentration: {len(rows)} portfolio{'s' if len(rows) != 1 else ''}, weekly returns to {end:%-d %b}.")
    for n in notes:
        summary(f"- {n}")
    return {"users": len(rows)}


if __name__ == "__main__":
    started = datetime.now(timezone.utc).isoformat()
    try:
        st = compute()
    except Exception as e:
        log_run("concentration", started, "failed", f"Concentration failed: {str(e)[:300]}")
        raise
    log_run("concentration", started, "ok", f"{st['users']} portfolios")
