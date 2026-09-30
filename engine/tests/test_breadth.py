from datetime import date, timedelta

import pytest

from fund_xray_engine import breadth as br
from fund_xray_engine import rotation as rot


def trading_days(n: int, start: date = date(2025, 1, 6)) -> list[date]:
    out, d = [], start
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d)
        d += timedelta(days=1)
    return out


def flat(days, price=100.0):
    return {d: price for d in days}


def ramp(days, start, end):
    n = len(days) - 1
    return {d: start + (end - start) * i / n for i, d in enumerate(days)}


# --- split and bonus adjustment ---

def test_a_split_reads_as_no_change():
    days = trading_days(4)
    rows = [br.StockDay(days[0], 1000, None), br.StockDay(days[1], 1010, 1000),
            br.StockDay(days[2], 505, 505),  # 1:2 split: NSE halves the previous close on the ex-date
            br.StockDay(days[3], 515, 505)]
    adj = br.adjusted(rows)
    assert adj[days[2]] == pytest.approx(1010)
    assert adj[days[3]] == pytest.approx(1010 * 515 / 505)


def test_bad_data_day_is_left_out_of_the_chain():
    days = trading_days(3)
    rows = [br.StockDay(days[0], 100, None), br.StockDay(days[1], 101, 0.01), br.StockDay(days[2], 102, 101)]
    adj = br.adjusted(rows)
    assert adj[days[1]] == pytest.approx(100)  # ratio 10,100 is nonsense: level held
    assert adj[days[2]] == pytest.approx(100 * 102 / 101)


# --- breadth ---

def test_breadth_counts_by_hand():
    days = trading_days(60)
    members = {
        "UP1": ramp(days, 100, 130), "UP2": ramp(days, 50, 60),   # above average, up
        "DOWN": ramp(days, 100, 80),                              # below average, down
        "FLAT1": flat(days), "FLAT2": flat(days),                 # at the average: not above, not up
    }
    b = br.breadth(members, None, [days[-1]], days)[0]
    assert b.members == 5
    assert b.pct_above_avg == pytest.approx(40)
    assert b.pct_up == pytest.approx(40)
    assert b.index_return is None and b.narrow is False


def test_one_heavyweight_doubling_is_flagged_narrow():
    days = trading_days(60)
    members = {f"S{i}": flat(days) for i in range(19)}
    members["BIG"] = {d: (100.0 if i <= 39 else 200.0) for i, d in enumerate(days)}  # doubles 20 days ago, then holds
    index = {d: (1000.0 if i <= 39 else 1400.0) for i, d in enumerate(days)}  # the index rides the heavyweight: +40%
    b = br.breadth(members, index, [days[-1]], days)[0]
    assert b.ew_return == pytest.approx(5)  # (100% + 19 × 0%) / 20
    assert b.index_return == pytest.approx(40)
    assert b.spread == pytest.approx(35)
    assert b.narrow is True
    assert b.pct_up == pytest.approx(5)


def test_a_broad_move_is_not_narrow():
    days = trading_days(60)
    members = {f"S{i}": ramp(days, 100, 110) for i in range(10)}
    index = ramp(days, 1000, 1100)
    b = br.breadth(members, index, [days[-1]], days)[0]
    assert b.pct_up == 100 and b.pct_above_avg == 100
    assert abs(b.spread) < br.NARROW_POINTS and not b.narrow


def test_members_without_enough_history_are_left_out():
    days = trading_days(60)
    members = {f"S{i}": ramp(days, 100, 110) for i in range(5)}
    members["NEW"] = {d: 50.0 for d in days[-10:]}  # listed 10 days ago
    b = br.breadth(members, None, [days[-1]], days)[0]
    assert b.members == 5


def test_too_few_members_gives_no_reading():
    days = trading_days(60)
    assert br.breadth({"A": flat(days)}, None, [days[-1]], days) == []


def test_week_ends_picks_the_last_trading_day():
    days = trading_days(10)  # Mon 6 Jan to Fri 17 Jan 2025
    assert br.week_ends(days) == [date(2025, 1, 10), date(2025, 1, 17)]


# --- regime ---

def ratios(cyc, dfn):
    return {**{k: cyc for k in br.CYCLICAL}, **{k: dfn for k in br.DEFENSIVE}}


def test_regime_rules():
    d = date(2026, 9, 25)
    assert br.regime(ratios(104, 100), 60, d).regime == br.CYCLICAL_LEAD
    assert br.regime(ratios(104, 100), 45, d).regime == br.NEUTRAL  # cyclicals ahead but most stocks aren't
    assert br.regime(ratios(100, 103), 45, d).regime == br.DEFENSIVE_LEAD
    assert br.regime(ratios(101, 100), 70, d).regime == br.NEUTRAL
    assert br.regime(ratios(104, 100), None, d).regime == br.NEUTRAL


def test_this_weeks_real_numbers_read_defensive():
    # Ratios vs Nifty 500 for the week ending 29 Sep 2026, from the rotation run.
    r = {"nifty-bank": 99.99, "nifty-auto": 97.63, "nifty-metal": 104.49, "nifty-realty": 98.73,
         "nifty-infra": 99.41, "nifty-pse": 100.54, "nifty-fmcg": 99.37, "nifty-pharma": 106.59,
         "nifty-healthcare": 104.92}
    g = br.regime(r, 48, date(2026, 9, 29))
    assert g.spread == pytest.approx(-3.50, abs=0.01)
    assert g.regime == br.DEFENSIVE_LEAD


def test_regime_needs_half_of_each_group():
    r = {"nifty-bank": 105, "nifty-pharma": 100, "nifty-fmcg": 100}
    assert br.regime(r, 60, date(2026, 9, 25)) is None


# --- steady quadrant labels ---

def test_settled_label_ignores_small_crossings():
    s = None
    s = rot.settle(s, 100.3, 101)      # starts on the raw side: ahead
    assert s == (True, True)
    s = rot.settle(s, 99.8, 101)       # dips 0.2 under 100: still ahead
    assert s == (True, True)
    s = rot.settle(s, 99.4, 101)       # 0.6 under: now behind
    assert s == (False, True)
    s = rot.settle(s, 100.2, 99.7)     # back over by 0.2, momentum dips 0.3: no change
    assert s == (False, True)
    assert rot.sides_quadrant(*s) == rot.IMPROVING


def test_scores_carry_both_labels():
    days = trading_days(200)
    bench = {d: 100.0 for d in days}
    # wobbles ±0.2% around a flat line: raw quadrant flips, settled one shouldn't flip often
    index = {d: 100.0 * (1 + (0.002 if i % 7 < 3 else -0.002)) for i, d in enumerate(days)}
    s = rot.scores(index, bench)
    raw_flips = sum(a.quadrant != b.quadrant for a, b in zip(s, s[1:]))
    settled_flips = sum(a.settled != b.settled for a, b in zip(s, s[1:]))
    assert raw_flips > 10
    assert settled_flips < raw_flips / 5


def test_near_line():
    assert rot.near_line(100.3, 104)
    assert rot.near_line(103, 99.8)
    assert not rot.near_line(101, 99)
