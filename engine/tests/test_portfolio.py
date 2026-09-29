from fund_xray_engine.portfolio import build_snapshot, company_name


def h(sym, qty, avg, last, close, t1=0, pledged=0, isin=None):
    return {"tradingsymbol": sym, "exchange": "NSE", "isin": isin or f"INE{sym[:6]}", "quantity": qty, "t1_quantity": t1,
            "collateral_quantity": pledged, "average_price": avg, "last_price": last, "close_price": close}


def test_totals_and_weights():
    s = build_snapshot([h("AAA", 10, 100, 110, 105), h("BBB", 5, 200, 190, 200)])
    t = s["totals"]
    assert t["invested"] == 2000.0          # 10*100 + 5*200
    assert t["value"] == 2050.0             # 10*110 + 5*190
    assert t["pnl"] == 50.0 and t["pnl_pct"] == 2.5
    assert t["day_change"] == 0.0           # +50 on AAA, −50 on BBB
    assert t["holdings_count"] == 2
    assert [x["symbol"] for x in s["holdings"]] == ["AAA", "BBB"]  # biggest first
    assert round(sum(x["weight_pct"] for x in s["holdings"]), 1) == 100.0
    assert s["holdings"][1]["pnl_pct"] == -5.0 and s["holdings"][1]["day_change_pct"] == -5.0


def test_t1_counts_and_zero_quantity_drops_out():
    s = build_snapshot([h("NEW", 0, 50, 55, 54, t1=4), h("SOLD", 0, 10, 12, 11)])
    assert [x["symbol"] for x in s["holdings"]] == ["NEW"]
    assert s["holdings"][0]["quantity"] == 4 and s["holdings"][0]["notes"] == ["4 in T1"]


def test_exact_money_over_many_rows():
    rows = [h(f"S{i:03d}", 3, 33.33, 33.37, 33.35) for i in range(58)]
    t = build_snapshot(rows)["totals"]
    assert t["invested"] == 5799.42 and t["value"] == 5806.38   # 58*3*33.33 ; 58*3*33.37, no float drift


def test_no_close_price_means_no_day_change():
    s = build_snapshot([h("IPO", 10, 100, 120, 0)])
    assert s["holdings"][0]["day_change"] == 0.0


def test_positions_kept_separate():
    s = build_snapshot([h("AAA", 1, 1, 1, 1)], {"net": [
        {"tradingsymbol": "BUYTODAY", "exchange": "NSE", "product": "CNC", "quantity": 2, "average_price": 10, "last_price": 11, "pnl": 2},
        {"tradingsymbol": "FLAT", "exchange": "NSE", "product": "MIS", "quantity": 0, "average_price": 0, "last_price": 5, "pnl": 0},
    ]})
    assert [p["symbol"] for p in s["positions"]] == ["BUYTODAY"]
    assert s["totals"]["positions_pnl"] == 2.0 and s["totals"]["value"] == 1.0


def test_names():
    s = build_snapshot([h("TATAMOTORS", 1, 1, 1, 1)], names={"NSE:TATAMOTORS": "TATA MOTORS"})
    assert s["holdings"][0]["name"] == "Tata Motors"
    assert company_name("HDFC BANK", "HDFCBANK") == "HDFC Bank"
    assert company_name("KPI GREEN ENERGY", "KPIGREEN") == "KPI Green Energy"
    assert company_name(None, "XYZ") == "XYZ"
    assert s["holdings"][0]["pledged_quantity"] == 0
