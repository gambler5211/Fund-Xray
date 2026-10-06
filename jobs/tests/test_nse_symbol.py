"""Kite lists many holdings under BSE; the jobs find each one's NSE symbol through its ISIN."""

import backfill_stock_prices as bsp

INDUSTRY_MAP = [
    {"isin": "INE002A01018", "symbol": "RELIANCE"},
    {"isin": "INE0ABC01011", "symbol": "NEWNAME"},  # renamed on NSE; Kite still shows the old BSE code
]


def by_isin():
    return {r["isin"]: r["symbol"] for r in INDUSTRY_MAP}


def test_nse_holding_keeps_its_symbol():
    h = {"exchange": "NSE", "symbol": "RELIANCE", "isin": "INE002A01018"}
    assert bsp.nse_symbol(h, by_isin()) == "RELIANCE"


def test_bse_holding_maps_through_isin():
    h = {"exchange": "BSE", "symbol": "OLDCODE", "isin": "INE0ABC01011"}
    assert bsp.nse_symbol(h, by_isin()) == "NEWNAME"


def test_unknown_isin_falls_back_to_kite_symbol():
    h = {"exchange": "BSE", "symbol": "SMALLCO", "isin": "INE999Z01019"}
    assert bsp.nse_symbol(h, by_isin()) == "SMALLCO"


def test_missing_isin_falls_back_to_kite_symbol():
    assert bsp.nse_symbol({"exchange": "BSE", "symbol": "SMALLCO"}, by_isin()) == "SMALLCO"
    assert bsp.nse_symbol({"exchange": "BSE", "symbol": "SMALLCO", "isin": None}, by_isin()) == "SMALLCO"


def test_no_symbol_and_no_match_gives_none():
    assert bsp.nse_symbol({"isin": "INE999Z01019"}, by_isin()) is None


def test_nse_symbol_map_reads_industry_map(monkeypatch):
    seen = {}

    def fake_select_all(table, params):
        seen["table"] = table
        return INDUSTRY_MAP

    monkeypatch.setattr(bsp, "db_select_all", fake_select_all)
    assert bsp.nse_symbol_map() == by_isin()
    assert seen["table"] == "industry_map"


def test_held_symbols_includes_bse_holdings(monkeypatch):
    snapshots = [
        {"holdings": [
            {"exchange": "NSE", "symbol": "RELIANCE", "isin": "INE002A01018"},
            {"exchange": "BSE", "symbol": "OLDCODE", "isin": "INE0ABC01011"},
            {"exchange": "BSE", "symbol": "SMALLCO", "isin": "INE999Z01019"},
        ]},
        {"holdings": None},  # an empty snapshot doesn't break the run
    ]

    def fake_select_all(table, params):
        return INDUSTRY_MAP if table == "industry_map" else snapshots

    monkeypatch.setattr(bsp, "db_select_all", fake_select_all)
    assert bsp.held_symbols() == {"RELIANCE", "NEWNAME", "SMALLCO"}
