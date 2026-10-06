"""The valuation job writes rows only for accounts with access, with that account's rates."""

from datetime import date, timedelta

import compute_valuations as cv

OWNER, FRIEND = "owner-uuid", "friend-uuid"


def quarter_rows(symbol: str) -> list[dict]:
    ends = ["2023-03-31", "2023-06-30", "2023-09-30", "2023-12-31", "2024-03-31", "2024-06-30", "2024-09-30",
            "2024-12-31", "2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30"]
    out = []
    for e in ends:
        r = {"symbol": symbol, "period_end": e, "consolidated": True, "kind": "indas", "ytd_months": {"03": 12, "06": 3, "09": 6, "12": 9}[e[5:7]],
             "eps_q": 1.0, "eps_ytd": None, "shares": 10, "equity": None, "ocf_ytd": None, "capex_ytd": None,
             "filed_at": None, "source_url": f"https://nsearchives.nseindia.com/{symbol}-{e}.xml"}
        if e == "2026-03-31":
            r.update(equity=1000, ocf_ytd=150, capex_ytd=50)
        out.append(r)
    return out


def prices(symbol: str) -> list[dict]:
    out, d = [], date.today() - timedelta(days=3 * 365)
    while d <= date.today():
        if d.weekday() < 5:
            out.append({"symbol": symbol, "date": d.isoformat(), "close": 100, "prev_close": 100})
        d += timedelta(days=1)
    return out


def test_only_accounts_with_access_get_rows(monkeypatch):
    writes, deletes = [], []
    holdings = [{"exchange": "BSE", "symbol": "OLDCODE", "isin": "INE0ABC01011"}, {"exchange": "NSE", "symbol": "NIFTYBEES", "isin": "INF204KB14I2"}]

    def select_all(table, params):
        return {
            "feature_access": [{"user_id": OWNER}],
            "industry_map": [{"isin": "INE0ABC01011", "symbol": "NEWNAME", "industry": "Capital Goods"}],
            "company_financials": quarter_rows("NEWNAME"),
            "stock_prices": prices("NEWNAME"),
        }[table]

    def select(table, params):
        if table == "holdings_snapshot":
            assert params["user_id"] == f"eq.{OWNER}"
            return [{"taken_at": "2026-10-05T04:00:00+00:00", "holdings": holdings}]
        if table == "settings":
            return [{"valuation_discount_pct": "11.00", "valuation_terminal_pct": "4.00"}]
        raise AssertionError(table)

    monkeypatch.setattr(cv, "db_select_all", select_all)
    monkeypatch.setattr(cv, "db_select", select)
    monkeypatch.setattr(cv, "nse_symbol_map", lambda: {"INE0ABC01011": "NEWNAME"})
    monkeypatch.setattr(cv, "db_upsert", lambda t, rows, on_conflict: writes.extend(rows))
    monkeypatch.setattr(cv, "db_delete", lambda t, params: deletes.append(params))

    res = cv.compute()
    assert res == {"users": 1, "stocks": 1}
    [row] = writes
    assert row["user_id"] == OWNER and row["symbol"] == "NEWNAME"  # BSE holding found by ISIN; the ETF has no filings, no row
    assert row["pe"]["value"] == 100.0  # TTM EPS 4 × P/E 25
    assert row["graham"]["value"] > 0
    assert row["reverse_dcf"]["inputs"]["discount_rate"] == 0.11 and row["reverse_dcf"]["inputs"]["terminal_growth"] == 0.04
    assert deletes == [{"user_id": f"eq.{OWNER}", "symbol": 'not.in.("NEWNAME")'}]
    assert all(r["user_id"] != FRIEND for r in writes)


def test_no_access_writes_nothing(monkeypatch):
    monkeypatch.setattr(cv, "db_select_all", lambda t, p: [] if t == "feature_access" else (_ for _ in ()).throw(AssertionError(t)))
    monkeypatch.setattr(cv, "db_upsert", lambda *a, **k: (_ for _ in ()).throw(AssertionError("wrote")))
    assert cv.compute() == {"users": 0, "stocks": 0}
