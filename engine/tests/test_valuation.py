"""Valuation views, against numbers worked out by hand."""

from datetime import date, timedelta

import pytest

from fund_xray_engine import valuation as val
from fund_xray_engine.breadth import StockDay
from fund_xray_engine.financials import Missing, Row, YTD_MONTHS


def row(end: date, eps: float, shares: float = 10, **kw) -> Row:
    return Row(period_end=end, consolidated=kw.pop("consolidated", True), kind=kw.pop("kind", "indas"),
               ytd_months=YTD_MONTHS[end.month], eps_q=eps, eps_ytd=kw.pop("eps_ytd", None), shares=shares,
               equity=kw.pop("equity", None), ocf_ytd=kw.pop("ocf", None), capex_ytd=kw.pop("capex", None),
               filed=kw.pop("filed", None), source=kw.pop("source", None))


def quarter_ends(first: date, n: int) -> list[date]:
    out, y, m = [], first.year, first.month
    for _ in range(n):
        nxt = date(y + (m == 12), m % 12 + 1, 1)
        out.append(nxt - timedelta(days=1))
        m += 3
        if m > 12:
            m -= 12
            y += 1
    return out


def flat_days(start: date, end: date, close: float = 100.0) -> list[StockDay]:
    out, d = [], start
    while d <= end:
        if d.weekday() < 5:
            out.append(StockDay(d, close, close))
        d += timedelta(days=1)
    return out


# --- building blocks ---------------------------------------------------------------------------

def test_percentile():
    assert val.percentile([5, 1, 3, 2, 4], 50) == 3
    assert val.percentile([1, 2, 3, 4, 5], 25) == 2
    assert val.percentile([1, 2], 50) == 1.5
    assert val.percentile([7], 75) == 7


def test_graham_number():
    assert val.graham_number(10, 100) == pytest.approx(150)  # √22,500
    assert val.graham_number(-1, 100) is None and val.graham_number(10, 0) is None


def test_dcf_value_with_no_growth():
    # 100 a year for 10 years at 12%: 100 × (1 − 1.12^-10) / 0.12 = 565.02
    # then 100 × 1.05 / (0.12 − 0.05) = 1,500 at year 10, worth 1,500 / 1.12^10 = 482.96 today
    assert val.dcf_value(100, 0.0, 0.12, 0.05) == pytest.approx(565.0223 + 482.9595, abs=0.01)


def test_implied_growth_inverts_dcf_value():
    assert val.implied_growth(1047.98, 100) == pytest.approx(0.0, abs=1e-4)
    target = val.dcf_value(100, 0.15, 0.12, 0.05)
    assert val.implied_growth(target, 100) == pytest.approx(0.15, abs=1e-6)


def test_implied_growth_edges():
    assert isinstance(val.implied_growth(1000, 0), Missing)
    assert isinstance(val.implied_growth(1000, -5), Missing)
    assert "more than 100%" in val.implied_growth(1e15, 1).reason
    assert "shrinking" in val.implied_growth(1, 1000).reason
    with pytest.raises(ValueError):
        val.dcf_value(100, 0.1, 0.05, 0.05)


# --- the three views ---------------------------------------------------------------------------

QS = quarter_ends(date(2023, 3, 1), 14)  # Mar 2023 .. Jun 2026


def steady_company(**kw):
    """10 shares, EPS 1 every quarter (TTM profit 40), at ₹100 throughout: P/E 25 every week."""
    return [row(d, 1.0, 10, **kw) for d in QS]


def test_pe_view_flat_history():
    days = flat_days(date(2023, 9, 29), date(2026, 9, 29))
    v = val.pe_view(100.0, days, steady_company())
    assert v["inputs"]["median_pe"] == 25.0 and v["inputs"]["current_pe"] == 25.0
    assert v["value"] == 100.0 and v["low"] == 100.0 and v["high"] == 100.0  # TTM EPS 4 × 25


def test_pe_view_range_from_price_moves():
    # A real move: on 31 Mar 2025 the price goes 80 -> 120 with NSE's previous close at 80
    # (a previous close equal to the new close would instead read as a split or bonus).
    later = flat_days(date(2025, 3, 31), date(2026, 9, 29), 120.0)
    later[0] = StockDay(later[0].date, 120.0, 80.0)
    days = flat_days(date(2023, 9, 29), date(2025, 3, 28), 80.0) + later
    v = val.pe_view(120.0, days, steady_company())
    assert v["inputs"]["pe_25"] == pytest.approx(20.0) and v["inputs"]["pe_75"] == pytest.approx(30.0)
    assert v["low"] == pytest.approx(80.0) and v["high"] == pytest.approx(120.0)


def test_pe_view_uses_only_published_results():
    # Results for Jun 2026 are filed 25 Sep 2026 with a big jump; weeks before that use the old TTM.
    rows = steady_company()[:-1] + [row(QS[-1], 5.0, 10, filed=date(2026, 9, 25))]
    pes = dict(val.weekly_pe(flat_days(date(2026, 8, 3), date(2026, 9, 29)), rows))
    assert pes[date(2026, 9, 18)] == pytest.approx(25.0)  # TTM 40
    assert pes[date(2026, 9, 25)] == pytest.approx(100 * 10 / 80)  # TTM 1+1+1+5 = 8 a share, 80 in all


def test_pe_view_after_a_split():
    # 1:2 split on 1 Jul 2025: raw price halves (NSE's previous close is halved too), shares double, EPS halves.
    rows = [row(d, 1.0, 10) for d in QS if d < date(2025, 7, 1)] + [row(d, 0.5, 20) for d in QS if d >= date(2025, 7, 1)]
    days = flat_days(date(2023, 9, 29), date(2025, 6, 30), 100.0)
    days += [StockDay(date(2025, 7, 1), 50.0, 50.0)] + flat_days(date(2025, 7, 2), date(2026, 9, 29), 50.0)
    v = val.pe_view(50.0, days, rows)
    assert v["inputs"]["median_pe"] == pytest.approx(25.0) and v["inputs"]["ttm_eps"] == pytest.approx(2.0)


def test_pe_view_missing():
    assert "loss" in val.pe_view(100, flat_days(date(2025, 1, 1), date(2026, 9, 1)), [row(d, -1.0) for d in QS])["missing"]
    assert "weeks" in val.pe_view(100, flat_days(date(2026, 6, 1), date(2026, 9, 1)), steady_company())["missing"]


def test_graham_view():
    rows = steady_company()[:-1] + [row(QS[-1], 1.0, 10, equity=1000)]  # book value 100 a share, EPS 4
    v = val.graham_view(rows)
    assert v["value"] == pytest.approx(math_sqrt(22.5 * 4 * 100), abs=0.01) and "harshly" in v["note"]
    assert "balance sheet" in val.graham_view(steady_company())["missing"]


def math_sqrt(x):
    import math
    return math.sqrt(x)


def test_reverse_dcf_view():
    rows = steady_company()[:-2] + [row(QS[-2], 1.0, 10, ocf=150, capex=50), row(QS[-1], 1.0, 10)]  # FY to Mar 2026: FCF 100
    v = val.reverse_dcf_view(104.798, rows, financial=False, r=0.12, tg=0.05)  # market value 1,047.98
    assert v["value"] == pytest.approx(0.0, abs=1e-4)
    assert v["inputs"]["fcf"] == 100 and v["inputs"]["market_value"] == 1048 and v["inputs"]["discount_rate"] == 0.12


def test_reverse_dcf_skips_banks_and_negative_cash_flow():
    assert "banks" in val.reverse_dcf_view(100, steady_company(), financial=True, r=0.12, tg=0.05)["missing"]
    rows = steady_company()[:-2] + [row(QS[-2], 1.0, 10, ocf=10, capex=50), row(QS[-1], 1.0, 10)]
    assert "negative" in val.reverse_dcf_view(100, rows, financial=False, r=0.12, tg=0.05)["missing"]


def test_views_puts_it_together():
    rows = steady_company(consolidated=False)
    v = val.views(flat_days(date(2023, 9, 29), date(2026, 9, 29)), rows, sector="Information Technology")
    assert v["basis"] == "standalone" and v["price"] == 100.0 and not v["financial"]
    assert v["pe"]["value"] == 100.0
    assert v["reverse_dcf"]["missing"] and v["graham"]["missing"]  # no cash flow or balance sheet in this data
    bank = val.views(flat_days(date(2025, 1, 1), date(2026, 9, 29)), steady_company(kind="banking"), sector=None)
    assert bank["financial"] and "banks" in bank["reverse_dcf"]["missing"]
    assert val.views([], rows, None)["missing"].startswith("no NSE prices")
    assert val.views(flat_days(date(2026, 1, 1), date(2026, 2, 1)), [], None)["missing"].startswith("no results")
