from datetime import date

from fund_xray_engine.nse import close_all_url, norm, parse_close_all, parse_constituents, sector_split, weekdays

CLOSE = """Index Name,Index Date,Open Index Value,High Index Value,Low Index Value,Closing Index Value,Points Change,Change(%),Volume,Turnover (Rs. Cr.),P/E,P/B,Div Yield
Nifty 50,31-01-2024,21487.25,21741.35,21448.85,21725.7,203.6,.95,410583065,41587.85,22.46,3.81,1.23
NIFTY Midcap 100,31-01-2024,47000,47500,46900,47400.1,1,1,1,1,-,-,-
India VIX,31-01-2024,-,-,-,15.2,0,0,-,-,-,-,-
Broken,31-01-2024,1,1,1,-,0,0,0,0,0,0,0
"""

LIST = """﻿Company Name,Industry,Symbol,Series,ISIN Code
ABB India Ltd.,Capital Goods,ABB,EQ,INE117A01022
ACME Solar Holdings Ltd.,Power,ACMESOLAR,EQ,INE622W01025
Bad Row,,X,EQ,
"""


def test_parse_close_all():
    rows = parse_close_all(CLOSE)
    assert [r["name"] for r in rows] == ["Nifty 50", "NIFTY Midcap 100", "India VIX"]
    n50 = rows[0]
    assert n50["date"] == "2024-01-31" and n50["close"] == 21725.7 and n50["pe"] == 22.46
    assert rows[1]["pe"] is None and rows[2]["open"] is None


def test_constituents():
    rows = parse_constituents(LIST)
    assert rows == [
        {"isin": "INE117A01022", "symbol": "ABB", "company_name": "ABB India Ltd.", "industry": "Capital Goods"},
        {"isin": "INE622W01025", "symbol": "ACMESOLAR", "company_name": "ACME Solar Holdings Ltd.", "industry": "Power"},
    ]


def test_calendar_and_urls():
    days = list(weekdays(date(2026, 9, 25), date(2026, 9, 29)))  # Fri..Tue
    assert [d.isoformat() for d in days] == ["2026-09-25", "2026-09-28", "2026-09-29"]
    assert close_all_url(date(2024, 1, 31)).endswith("ind_close_all_31012024.csv")
    assert norm("NIFTY  Midcap 100") == norm("Nifty Midcap 100")


def test_sector_split_adds_to_100():
    h = [{"exchange": "NSE", "symbol": s, "name": s, "value": v} for s, v in [("A", 50), ("B", 30), ("C", 20)]]
    g = sector_split(h, {"NSE:A": "Power", "NSE:B": "Power"})
    assert [x["sector"] for x in g] == ["Power", "Unmapped"]
    assert g[0]["share_pct"] == 80.0 and g[1]["share_pct"] == 20.0
    assert sum(x["share_pct"] for x in g) == 100.0
    assert [x["symbol"] for x in g[0]["holdings"]] == ["A", "B"]


def test_quote_industry_and_funds():
    from fund_xray_engine.nse import looks_like_fund, parse_quote_industry

    got = parse_quote_industry({"industryInfo": {"macro": "Industrials", "sector": "Capital Goods",
                                                 "industry": "Electrical Equipment", "basicIndustry": "Heavy Electrical Equipment"}})
    assert got == {"industry": "Capital Goods", "macro": "Industrials", "industry_detail": "Electrical Equipment",
                   "basic_industry": "Heavy Electrical Equipment"}
    new = {"equityResponse": [{"secInfo": {"basicIndustry": "Dredging", "macro": "Services", "sector": "Services",
                                            "industryInfo": "Engineering Services"}}]}
    assert parse_quote_industry(new) == {"industry": "Services", "macro": "Services", "industry_detail": "Engineering Services",
                                         "basic_industry": "Dredging"}
    assert parse_quote_industry({"equityResponse": [{"secInfo": {"sector": "-", "basicIndustry": "-"}}]}) is None
    assert parse_quote_industry({"info": {}}) is None
    assert parse_quote_industry({"industryInfo": {"sector": "NA"}}) is None
    assert looks_like_fund("SILVERBEES", "Nippon India Silver ETF")
    assert looks_like_fund("METAL", "Mirae Asset Nifty Metal ETF")
    assert not looks_like_fund("DREDGECORP", "Dredging Corp Of India")


BHAV = """SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, LAST_PRICE, CLOSE_PRICE, AVG_PRICE, TTL_TRD_QNTY, TURNOVER_LACS, NO_OF_TRADES, DELIV_QTY, DELIV_PER
20MICRONS, EQ, 29-Sep-2026, 212.94, 212.16, 216.45, 209.02, 211.20, 212.80, 212.99, 54062, 115.14, 2439, 24068, 44.52
RELIANCE, EQ, 29-Sep-2026, 1400.00, 1401, 1410, 1395, 1405, 1404.50, 1403, 1234567, 17000, 90000, 600000, 48.6
RELIANCE, BL, 29-Sep-2026, 1400.00, 1401, 1410, 1395, 1405, 1406.00, 1403, 100, 1, 1, -, -
TWOSER, BE, 29-Sep-2026, 50, 50, 51, 49, 50, 50.50, 50, 10, 0.1, 2, -, -
TWOSER, EQ, 29-Sep-2026, 50, 50, 51, 49, 50, 50.40, 50, 99, 0.5, 3, -, -
GOLDBEES, EQ, 29-Sep-2026, 80, 80, 81, 79, 80, -, 80, 10, 0.1, 2, -, -
"""


def test_parse_bhavcopy_keeps_equity_series_one_row_each():
    from fund_xray_engine.nse import bhavcopy_url, parse_bhavcopy
    rows = {r["symbol"]: r for r in parse_bhavcopy(BHAV)}
    assert set(rows) == {"20MICRONS", "RELIANCE", "TWOSER"}  # GOLDBEES has no close
    assert rows["RELIANCE"] == {"symbol": "RELIANCE", "series": "EQ", "date": "2026-09-29",
                                "prev_close": 1400.0, "close": 1404.5, "volume": 1234567}  # block deal (BL) ignored
    assert rows["TWOSER"]["series"] == "EQ" and rows["TWOSER"]["close"] == 50.4  # EQ preferred over BE
    assert [r["symbol"] for r in parse_bhavcopy(BHAV, {"RELIANCE"})] == ["RELIANCE"]
    from datetime import date
    assert bhavcopy_url(date(2026, 9, 29)).endswith("/sec_bhavdata_full_29092026.csv")
