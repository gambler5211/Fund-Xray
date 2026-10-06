"""Results filings: parsing real (trimmed) NSE files, and the per-share series built from them."""

from datetime import date
from pathlib import Path

import pytest

from fund_xray_engine import financials as fin
from fund_xray_engine.financials import Missing, Row

FIX = Path(__file__).parent / "fixtures"


def load(name: str) -> fin.Filing:
    return fin.parse_filing((FIX / name).read_bytes())


# --- parsing -----------------------------------------------------------------------------------

def test_new_format_half_year():
    f = load("tcs_2025_09_consolidated.xml")
    assert f.period_end == date(2025, 9, 30)
    assert f.consolidated and f.kind == "indas"
    assert f.ytd_months == 6
    assert f.eps_q == 33.37 and f.eps_ytd == 68.64
    assert f.shares == 3_620_000_000  # ₹362 crore paid up at ₹1 face value
    assert f.equity == 1_064_150_000_000  # owners' share, not the 1,074,610 crore that includes minorities
    assert f.ocf_ytd == 249_440_000_000
    assert f.capex_ytd == 18_680_000_000 + 1_930_000_000
    assert f.revenue_q == 657_990_000_000  # the segment figure (999) sits in a dimensional context and is ignored
    assert f.profit_q == 120_750_000_000


def test_old_format_takes_year_to_date_from_the_context_name():
    f = load("tcs_2024_09_old_format.xml")
    assert f.period_end == date(2024, 9, 30)  # from the quarter's context; no DateOfEnd fact in old files
    assert f.ytd_months == 6  # September: April to September, though FourD prints July to September
    assert f.eps_q == 32.92 and f.eps_ytd == 66.20
    assert f.ocf_ytd == 219_990_000_000
    assert f.capex_ytd == 14_910_000_000 + 1_990_000_000


def test_bank_format():
    f = load("hdfcbank_2026_03_consolidated.xml")
    assert f.kind == "banking"
    assert f.ytd_months == 12
    assert f.eps_q == 13.22 and f.eps_ytd == 49.5
    assert f.shares == pytest.approx(15_393_400_000)
    assert f.equity == pytest.approx(15_393_400_000 + 5_799_750_200_000)  # capital + reserves
    assert f.ocf_ytd == 1_135_063_800_000
    assert f.capex_ytd is None  # banks don't tag capex this way; reverse DCF is skipped for them anyway


def test_not_a_filing():
    with pytest.raises(fin.FilingError):
        fin.parse_filing("<html><body>Access denied</body></html>")
    with pytest.raises(fin.FilingError):
        fin.parse_filing("not xml at all")


# --- series ------------------------------------------------------------------------------------

def q(end: date, eps: float, shares: float = 100.0, **kw) -> Row:
    return Row(period_end=end, consolidated=kw.pop("consolidated", True), kind="indas",
               ytd_months=fin.YTD_MONTHS[end.month], eps_q=eps, eps_ytd=kw.pop("eps_ytd", None), shares=shares,
               equity=kw.pop("equity", None), ocf_ytd=kw.pop("ocf", None), capex_ytd=kw.pop("capex", None))


FOUR = [date(2025, 9, 30), date(2025, 12, 31), date(2026, 3, 31), date(2026, 6, 30)]


def test_ttm_eps_adds_the_last_four_quarters():
    rows = [q(d, e) for d, e in zip(FOUR, [10, 11, 12, 13])]
    end, eps = fin.ttm_eps(rows)
    assert end == date(2026, 6, 30) and eps == pytest.approx(46)


def test_ttm_eps_puts_a_split_on_todays_share_count():
    # 1:2 split before the last quarter: shares double, EPS halves. Profit was 1,000 a quarter throughout.
    rows = [q(FOUR[0], 10, 100), q(FOUR[1], 10, 100), q(FOUR[2], 10, 100), q(FOUR[3], 5, 200)]
    end, eps = fin.ttm_eps(rows)
    assert eps == pytest.approx(4000 / 200)  # 20, not 35


def test_ttm_eps_refuses_a_gap():
    rows = [q(d, 10) for d in (FOUR[0], FOUR[1], FOUR[3])]
    got = fin.ttm_eps(rows)
    assert isinstance(got, Missing) and "Mar 2026" in got.reason


def test_ttm_eps_as_of_an_earlier_date():
    rows = [q(date(2025, 6, 30), 9)] + [q(d, e) for d, e in zip(FOUR, [10, 11, 12, 13])]
    end, eps = fin.ttm_eps(rows, as_of=date(2026, 4, 15))
    assert end == date(2026, 3, 31) and eps == pytest.approx(9 + 10 + 11 + 12)


def test_pick_basis_prefers_consolidated_when_latest_has_it():
    rows = [q(FOUR[3], 5, consolidated=False), q(FOUR[3], 6, consolidated=True), q(FOUR[2], 4, consolidated=True)]
    assert all(r.consolidated for r in fin.pick_basis(rows))
    only_standalone = [q(FOUR[3], 5, consolidated=False), q(FOUR[2], 4, consolidated=True)]
    assert all(not r.consolidated for r in fin.pick_basis(only_standalone))


def test_book_value_uses_the_latest_balance_sheet():
    rows = [q(date(2026, 3, 31), 10, 100, equity=50_000), q(date(2026, 6, 30), 10, 100)]
    assert fin.book_value_per_share(rows) == (date(2026, 3, 31), 500)
    assert isinstance(fin.book_value_per_share([q(FOUR[3], 10)]), Missing)


def test_fcf_after_a_year_end():
    rows = [q(date(2026, 3, 31), 10, ocf=150, capex=50)]
    assert fin.ttm_fcf(rows) == (date(2026, 3, 31), 100, "year to Mar 2026")


def test_fcf_after_a_half_year_rolls_the_year_forward():
    rows = [q(date(2024, 9, 30), 10, ocf=60, capex=20),   # last year's first half: 40
            q(date(2025, 3, 31), 10, ocf=130, capex=30),  # last full year: 100
            q(date(2025, 9, 30), 10, ocf=80, capex=20)]   # this year's first half: 60
    end, fcf, how = fin.ttm_fcf(rows)
    assert end == date(2025, 9, 30) and fcf == 120 and how.startswith("trailing 12 months")


def test_fcf_falls_back_to_the_last_year_without_last_years_half():
    rows = [q(date(2025, 3, 31), 10, ocf=130, capex=30), q(date(2025, 9, 30), 10, ocf=80, capex=20)]
    assert fin.ttm_fcf(rows)[1] == 100


def test_fcf_missing_reasons():
    assert "cash-flow statement" in fin.ttm_fcf([q(FOUR[3], 10)]).reason
    assert "capex" in fin.ttm_fcf([q(date(2026, 3, 31), 10, ocf=100)]).reason


def test_past_growth_from_free_cash_flow():
    rows = [q(date(2023, 3, 31), 10, ocf=100, capex=0), q(date(2026, 3, 31), 10, ocf=133.1, capex=0)]
    what, g, years = fin.past_growth(rows)
    assert what == "free cash flow" and years == 3 and g == pytest.approx(0.10, abs=1e-3)


def test_past_growth_falls_back_to_profit_when_cash_flow_turned_negative():
    rows = [q(date(2024, 3, 31), 10, eps_ytd=40, ocf=-10, capex=5), q(date(2026, 3, 31), 10, eps_ytd=48.4, ocf=100, capex=5)]
    what, g, years = fin.past_growth(rows)
    assert what == "profit" and g == pytest.approx(0.10, abs=2e-3)


def test_to_rows_reads_database_strings():
    [r] = fin.to_rows([{"period_end": "2026-03-31", "consolidated": True, "kind": "indas", "ytd_months": 12,
                        "eps_q": "13.22", "eps_ytd": "49.5", "shares": "100", "equity": None, "ocf_ytd": "5",
                        "capex_ytd": "1", "filed_at": "2026-04-18T07:30:48+00:00", "source_url": "https://x"}])
    assert r.eps_q == 13.22 and r.filed == date(2026, 4, 18) and r.equity is None


# --- filing lists --------------------------------------------------------------------------------

OLD = [  # fields as NSE's /api/corporates-financial-results returns them (TCS, trimmed)
    {"toDate": "31-Dec-2024", "consolidated": "Consolidated", "cumulative": "Non-cumulative",
     "broadCastDate": "09-Jan-2025 21:39:43", "xbrl": "https://nsearchives.nseindia.com/corporate/xbrl/INDAS_117182_1341298_09012025093940.xml"},
    {"toDate": "31-Dec-2024", "consolidated": "Non-Consolidated", "cumulative": "Non-cumulative",
     "broadCastDate": "09-Jan-2025 21:36:33", "xbrl": "https://nsearchives.nseindia.com/corporate/xbrl/INDAS_117180_1341293_09012025093547.xml"},
    {"toDate": "31-Mar-2005", "consolidated": "Non-Consolidated", "cumulative": "Non-cumulative", "xbrl": "-"},
]
NEW = [  # fields as /api/integrated-filing-results returns them
    {"qe_Date": "30-JUN-2026", "consolidated": "Consolidated", "type_Sub": "Original", "broadcast_Date": "09-Jul-2026 18:36:12",
     "xbrl": "https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1690004_09072026063620_WEB.xml"},
    {"qe_Date": "30-JUN-2026", "consolidated": "Standalone", "type_Sub": "Original", "broadcast_Date": "09-Jul-2026 18:36:04",
     "xbrl": "https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1690003_09072026063612_WEB.xml"},
    {"qe_Date": "31-MAR-2026", "consolidated": "Consolidated", "type_Sub": "Original", "broadcast_Date": "09-Apr-2026 17:42:10",
     "xbrl": "https://nsearchives.nseindia.com/corporate/xbrl/A.xml"},
    {"qe_Date": "31-MAR-2026", "consolidated": "Consolidated", "type_Sub": "Revised", "broadcast_Date": "11-Apr-2026 10:00:00",
     "xbrl": "https://nsearchives.nseindia.com/corporate/xbrl/B.xml"},
]


def test_refs_from_both_lists():
    old = fin.refs_from_old(OLD)
    assert [(r.period_end, r.consolidated) for r in old] == [(date(2024, 12, 31), True), (date(2024, 12, 31), False)]
    assert old[0].filed == "2025-01-09T21:39:43+05:30"
    new = fin.refs_from_integrated(NEW)
    assert len(new) == 4 and new[0].period_end == date(2026, 6, 30) and not new[1].consolidated and new[3].revised


def test_choose_refs_one_per_quarter_consolidated_and_revised_wins():
    refs = fin.refs_from_old(OLD) + fin.refs_from_integrated(NEW)
    got = fin.choose_refs(refs, since=date(2024, 1, 1))
    assert [r.period_end for r in got] == [date(2024, 12, 31), date(2026, 3, 31), date(2026, 6, 30)]
    assert all(r.consolidated for r in got)
    assert got[1].url.endswith("/B.xml")


def test_choose_refs_standalone_only_company():
    refs = [r for r in fin.refs_from_integrated(NEW) if not r.consolidated]
    assert [r.consolidated for r in fin.choose_refs(refs, date(2020, 1, 1))] == [False]


def test_history_start():
    assert fin.history_start(date(2026, 10, 6)) == date(2022, 12, 31)
    assert fin.history_start(date(2027, 2, 1)) == date(2022, 12, 31)  # March 2027 hasn't passed yet
    assert fin.history_start(date(2027, 4, 1)) == date(2023, 12, 31)
