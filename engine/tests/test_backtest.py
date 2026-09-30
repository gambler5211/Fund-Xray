from datetime import date, timedelta

import pytest

from fund_xray_engine import backtest as bt
from fund_xray_engine import breadth as br


def weekly(n: int, start: date = date(2025, 1, 3)) -> list[date]:
    return [start + timedelta(weeks=i) for i in range(n)]


def week(d, spread, breadth, fwd4=None, fwd8=None):
    return bt.Week(d, spread, breadth, {4: fwd4, 8: fwd8})


# --- the shared rule ---

def test_classify_matches_the_regime_rule():
    assert br.classify(3.0, 60) == br.CYCLICAL_LEAD
    assert br.classify(3.0, 40) == br.NEUTRAL           # cyclical lead needs market breadth above 50
    assert br.classify(-3.0, 20) == br.DEFENSIVE_LEAD   # defensive lead does not
    assert br.classify(1.0, 60) == br.NEUTRAL
    assert br.classify(3.0, None) == br.NEUTRAL
    assert br.classify(3.0, 40, breadth_min=0) == br.CYCLICAL_LEAD


# --- outcomes ---

def test_group_return_averages_the_members_that_have_prices():
    d0, d1 = weekly(2)
    prices = {"a": {d0: 100, d1: 110}, "b": {d0: 200, d1: 200}, "c": {d0: 50}}
    assert bt.group_return(prices, ["a", "b", "c"], d0, d1) == pytest.approx(5.0)  # (10 + 0) / 2


def test_group_return_needs_half_the_group():
    d0, d1 = weekly(2)
    prices = {"a": {d0: 100, d1: 110}}
    assert bt.group_return(prices, ["a", "b", "c"], d0, d1) is None


def test_outcome_is_cyclical_minus_defensive_and_unknown_near_the_end():
    days = weekly(6)
    prices = {
        "cyc": {d: 100 * (1.02 ** i) for i, d in enumerate(days)},   # +2% a week
        "def": {d: 100 * (1.01 ** i) for i, d in enumerate(days)},   # +1% a week
    }
    out = bt.outcomes(days, prices, ["cyc"], ["def"], horizons=(2, 4))
    assert out[days[0]][2] == pytest.approx(100 * (1.02 ** 2 - 1) - 100 * (1.01 ** 2 - 1))
    assert out[days[1]][4] == pytest.approx(100 * (1.02 ** 4 - 1) - 100 * (1.01 ** 4 - 1))
    assert out[days[2]][4] is None and out[days[5]][2] is None


# --- evaluating one setting, hand-worked ---

def sample():
    d = weekly(5)
    return [week(d[0], 3, 60, fwd4=2.0), week(d[1], 3, 60, fwd4=1.0), week(d[2], -3, 30, fwd4=-1.0),
            week(d[3], -3, 30, fwd4=3.0), week(d[4], 0, 50, fwd4=5.0)]


def test_hit_rate_calls_and_edge():
    r = bt.evaluate(sample(), threshold=2.0, breadth_min=50.0, horizon=4)
    assert (r.weeks, r.calls, r.cyclical_calls, r.defensive_calls) == (5, 4, 2, 2)
    assert r.hits == 3 and r.hit_rate == pytest.approx(75.0)   # the Defensive call before +3 missed
    assert r.edge == pytest.approx(1.5 - 1.0)                  # after Cyclical +1.5, after Defensive +1.0
    assert r.coverage == pytest.approx(4 / 5)
    assert r.flip_rate == pytest.approx(2 / 4)                 # C C D D N: two changes in four steps


def test_halves_are_scored_separately():
    r = bt.evaluate(sample(), 2.0, 50.0, 4)
    # 5 known weeks: first 2 are the earlier half (both hits), the last 3 hold 1 hit in 2 calls
    assert r.first_half == pytest.approx(100.0)
    assert r.second_half == pytest.approx(50.0)


def test_breadth_condition_removes_weak_cyclical_calls():
    weeks = sample()
    weeks[0] = week(weeks[0].date, 3, 40, fwd4=2.0)            # spread is there, breadth isn't
    r = bt.evaluate(weeks, 2.0, 50.0, 4)
    assert r.cyclical_calls == 1
    assert bt.evaluate(weeks, 2.0, 0.0, 4).cyclical_calls == 2  # breadth condition switched off


def test_weeks_without_an_outcome_make_no_calls_but_still_count_for_flips():
    weeks = sample()
    weeks[4] = week(weeks[4].date, -3, 30, fwd4=None)          # latest week: outcome unknown
    r = bt.evaluate(weeks, 2.0, 50.0, 4)
    assert r.weeks == 4 and r.calls == 4
    assert r.flip_rate == pytest.approx(1 / 4)                 # C C D D D


def test_higher_threshold_makes_fewer_calls():
    weeks = sample()
    assert bt.evaluate(weeks, 4.0, 50.0, 4).calls == 0
    assert bt.evaluate(weeks, 4.0, 50.0, 4).hit_rate is None


def test_base_rate():
    assert bt.base_rate(sample(), 4) == pytest.approx(80.0)    # 4 of the 5 outcomes are positive


def result(threshold, breadth_min, horizon, calls=30, hit=60.0, first=60.0, second=60.0, flip=0.1):
    return bt.Result(threshold, breadth_min, horizon, 100, calls, calls // 2, calls - calls // 2,
                     int(calls * hit / 100), hit, first, second, 1.0, calls / 100, flip)


def test_recommend_picks_the_best_qualifying_setting():
    rs = [result(2.0, 50.0, 4, hit=60), result(2.0, 50.0, 8, hit=64),
          result(3.0, 50.0, 4, hit=70), result(3.0, 50.0, 8, hit=72)]
    assert bt.recommend(rs) == (3.0, 50.0)


def test_recommend_skips_thin_jumpy_or_unstable_settings():
    rs = [result(1.0, 50.0, 4, hit=90, flip=0.4), result(1.0, 50.0, 8, hit=90, flip=0.4),      # flips too often
          result(2.0, 50.0, 4, hit=90, calls=8), result(2.0, 50.0, 8, hit=90, calls=8),        # too few calls
          result(3.0, 50.0, 4, hit=90, second=40), result(3.0, 50.0, 8, hit=90, second=40),    # fails in one half
          result(4.0, 50.0, 4, hit=55), result(4.0, 50.0, 8, hit=55)]
    assert bt.recommend(rs) == (4.0, 50.0)


def test_recommend_says_none_when_nothing_qualifies():
    assert bt.recommend([result(2.0, 50.0, 4, calls=5), result(2.0, 50.0, 8, calls=5)]) is None


def test_grid_covers_every_setting_and_horizon():
    weeks = sample()
    g = bt.grid(weeks, thresholds=(1.0, 2.0), breadths=(0.0, 50.0), horizons=(4,))
    assert len(g) == 4 and {(r.threshold, r.breadth_min) for r in g} == {(1.0, 0.0), (1.0, 50.0), (2.0, 0.0), (2.0, 50.0)}
