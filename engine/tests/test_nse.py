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
