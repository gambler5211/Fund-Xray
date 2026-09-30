import pytest

from fund_xray_engine import alignment as al
from fund_xray_engine.rotation import IMPROVING, LAGGING, LEADING, WEAKENING

SECTOR_INDEX = {"Information Technology": "nifty-it", "Healthcare": "nifty-healthcare",
                "Metals & Mining": "nifty-metal", "Construction": "nifty-infra"}


def h(symbol, value, isin=None, name=None):
    return al.Holding("NSE", symbol, isin, name or symbol, value)


def placed(*pairs):
    """(index_key or None, share) pairs as Placed rows."""
    return [al.Placed(f"S{i}", f"S{i}", s, s, None, k) for i, (k, s) in enumerate(pairs)]


# --- sectors for holdings ---

def test_sector_order_is_yours_then_isin_then_symbol_then_fund():
    by_isin, by_sym = {"INE1": "Healthcare"}, {"TCS": "Information Technology", "SUN": "Metals & Mining"}
    own = {"NSE:SUN": "Construction"}
    assert al.industry_of(h("SUN", 1, "INE1"), by_isin, by_sym, own) == "Construction"
    assert al.industry_of(h("XYZ", 1, "INE1"), by_isin, by_sym, {}) == "Healthcare"
    assert al.industry_of(h("TCS", 1), by_isin, by_sym, {}) == "Information Technology"
    assert al.industry_of(h("GOLDBEES", 1), {}, {}, {}) == al.FUNDS
    assert al.industry_of(h("NEWCO", 1), {}, {}, {}) is None


def test_place_gives_shares_and_indices():
    p = al.place([h("TCS", 300), h("GOLDBEES", 100)], {}, {"TCS": "Information Technology"}, {}, SECTOR_INDEX)
    assert [(x.symbol, x.share, x.index_key) for x in p] == [("TCS", 75.0, "nifty-it"), ("GOLDBEES", 25.0, None)]


# --- the split, hand-worked ---

def test_all_in_one_leading_sector_is_all_gaining():
    s = al.split(placed(("nifty-it", 100.0)), {"nifty-it": LEADING})
    assert (s.gaining, s.losing, s.unmapped) == (100.0, 0.0, 0.0)


def test_split_by_quadrant_with_unmapped():
    s = al.split(placed(("nifty-it", 40.0), ("nifty-metal", 25.0), ("nifty-healthcare", 20.0), (None, 15.0)),
                 {"nifty-it": WEAKENING, "nifty-metal": IMPROVING, "nifty-healthcare": LEADING})
    assert (s.leading, s.improving, s.weakening, s.lagging, s.unmapped) == (20.0, 25.0, 40.0, 0.0, 15.0)
    assert s.gaining == 45.0 and s.losing == 40.0


def test_an_index_without_a_quadrant_counts_as_unmapped():
    s = al.split(placed(("nifty-it", 60.0), ("nifty-infra", 40.0)), {"nifty-it": LAGGING})
    assert s.unmapped == 40.0 and s.lagging == 60.0


def test_moving_one_sector_moves_exactly_its_share():
    p = placed(("nifty-it", 30.0), ("nifty-metal", 70.0))
    before = al.split(p, {"nifty-it": LEADING, "nifty-metal": LEADING})
    after = al.split(p, {"nifty-it": WEAKENING, "nifty-metal": LEADING})
    assert before.gaining - after.gaining == pytest.approx(30.0)


# --- the change, split into sectors and you ---

def test_change_splits_into_sectors_and_you():
    last_week = al.Split(50, 0, 30, 0, 20)                  # 50% gaining last week
    now = al.Split(70, 0, 10, 0, 20)                        # 70% now
    now_if_still = al.Split(60, 0, 20, 0, 20)               # same holdings, last week's quadrants: 60%
    c = al.change(now, last_week, now_if_still)
    assert (c.total, c.from_sectors, c.from_you) == (pytest.approx(20), pytest.approx(10), pytest.approx(10))


def test_no_change_without_last_week():
    assert al.change(al.Split(50, 0, 0, 0, 50), None, al.Split(50, 0, 0, 0, 50)) is None


# --- the market's split ---

def test_market_split_counts_stocks_and_leaves_out_unmatched_sectors():
    members = ["Information Technology"] * 3 + ["Healthcare"] * 1 + ["Textiles"] * 5 + [None]
    n, s = al.market_split(members, SECTOR_INDEX, {"nifty-it": LAGGING, "nifty-healthcare": LEADING})
    assert n == 4 and s.lagging == 75.0 and s.leading == 25.0 and s.gaining == 25.0


def test_market_split_none_when_nothing_matches():
    assert al.market_split(["Textiles"], SECTOR_INDEX, {}) is None
