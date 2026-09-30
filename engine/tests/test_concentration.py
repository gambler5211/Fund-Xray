import random
from datetime import date, timedelta

import pytest

from fund_xray_engine import concentration as cc


def fridays(n: int, start: date = date(2025, 1, 3)) -> list[date]:
    return [start + timedelta(weeks=i) for i in range(n)]


def weeks_of(days):
    return [tuple(d.isocalendar()[:2]) for d in days]


def walk(days, seed, drift=0.0, noise=0.03):
    rnd = random.Random(seed)
    p, out = 100.0, {}
    for d in days:
        out[d] = p
        p *= 1 + drift + rnd.gauss(0, noise)
    return out


# --- effective holdings ---

def test_ten_equal_holdings_read_ten():
    assert cc.effective_count([10] * 10) == pytest.approx(10)


def test_one_big_holding_pulls_it_down():
    assert cc.effective_count([50] + [50 / 9] * 9) == pytest.approx(1 / (0.25 + 9 * (0.5 / 9) ** 2))  # ~3.6


def test_effective_count_ignores_zero_and_empty():
    assert cc.effective_count([]) == 0.0
    assert cc.effective_count([100, 0]) == pytest.approx(1)


# --- returns and correlation ---

def test_weekly_returns_use_each_weeks_last_close():
    days = [date(2025, 1, 6), date(2025, 1, 10), date(2025, 1, 13), date(2025, 1, 17)]  # Mon, Fri, Mon, Fri
    prices = dict(zip(days, [90, 100, 999, 110]))
    r = cc.weekly_returns(prices, weeks_of([days[1], days[3]]))
    assert list(r.values()) == [pytest.approx(0.10)]


def test_identical_series_correlate_perfectly_and_flat_is_none():
    a = {i: v for i, v in enumerate([0.01, -0.02, 0.03, 0.0, 0.02] * 6)}
    assert cc.correlation(a, dict(a)) == pytest.approx(1.0)
    assert cc.correlation(a, {i: 0.0 for i in a}) is None
    assert cc.correlation(a, {0: 0.1}) is None  # too few common weeks


# --- clusters and effective bets ---

def test_identical_prices_form_one_cluster_and_unrelated_stay_apart():
    days = fridays(53)
    base = walk(days, 1)
    prices = {"HDFCBANK": base, "ICICIBANK": {d: 2 * p for d, p in base.items()},  # same moves, other price level
              "SUNPHARMA": walk(days, 2), "TCS": walk(days, 3)}
    c = cc.concentration({"HDFCBANK": 30, "ICICIBANK": 20, "SUNPHARMA": 25, "TCS": 25}, prices, weeks_of(days))
    groups = [g.symbols for g in c.clusters]
    assert groups[0] == ("HDFCBANK", "ICICIBANK") and c.clusters[0].share == 50
    assert ("SUNPHARMA",) in groups and ("TCS",) in groups
    assert c.clusters[0].correlation == pytest.approx(1.0)
    assert c.effective_holdings == pytest.approx(1 / (0.09 + 0.04 + 0.0625 + 0.0625))
    assert c.effective_bets == pytest.approx(1 / (0.25 + 0.0625 + 0.0625))  # 50 / 25 / 25 -> about 2.7


def test_short_history_is_left_out_and_counts_as_its_own_bet():
    days = fridays(53)
    prices = {"OLD": walk(days, 4), "NEW": {d: p for d, p in walk(days, 5).items() if d >= days[40]}}
    c = cc.concentration({"OLD": 60, "NEW": 40}, prices, weeks_of(days))
    assert c.left_out == ("NEW",)
    assert [g.symbols for g in c.clusters] == [("OLD",)]
    assert c.effective_bets == pytest.approx(1 / (0.36 + 0.16))


def test_a_holding_without_prices_is_left_out():
    days = fridays(53)
    c = cc.concentration({"A": 70, "GOLDBEES": 30}, {"A": walk(days, 6)}, weeks_of(days))
    assert c.left_out == ("GOLDBEES",) and c.holdings == 2


def test_average_linkage_does_not_chain_unrelated_stocks():
    # B is half A and half C; A and C are unrelated. B correlates ~0.7 with each, but A and C
    # shouldn't end up in one cluster through B.
    days = fridays(53)
    ra = cc.weekly_returns(walk(days, 7), weeks_of(days))
    rc = cc.weekly_returns(walk(days, 8), weeks_of(days))
    rb = {k: (ra[k] + rc[k]) / 2 for k in ra}
    groups = cc.clusters({"A": ra, "B": rb, "C": rc})
    assert not any({"A", "C"} <= set(g) for g, _ in groups)
