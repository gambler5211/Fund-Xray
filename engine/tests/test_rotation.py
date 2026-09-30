from datetime import date, timedelta

import pytest

from fund_xray_engine import rotation as rot


def trading_days(n: int, start: date = date(2025, 1, 6)) -> list[date]:
    """n weekdays from a Monday."""
    out, d = [], start
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d)
        d += timedelta(days=1)
    return out


def series(days, values):
    return dict(zip(days, values))


def test_quadrant_rules_including_the_100_boundary():
    assert rot.quadrant(101, 101) == rot.LEADING
    assert rot.quadrant(100, 100) == rot.LEADING
    assert rot.quadrant(101, 99) == rot.WEAKENING
    assert rot.quadrant(99, 99) == rot.LAGGING
    assert rot.quadrant(99, 100) == rot.IMPROVING


def test_flat_relative_strength_reads_100_100():
    days = trading_days(80)
    bench = series(days, [100 + i for i in range(80)])
    index = series(days, [2 * (100 + i) for i in range(80)])  # always exactly twice the benchmark
    s = rot.scores(index, bench)
    assert len(s) == 80 - rot.min_history() + 1
    assert all(x.ratio == pytest.approx(100) and x.momentum == pytest.approx(100) for x in s)


def test_hand_worked_small_window():
    # n = 3, k = 1. RS = 1, 1, 1, 2 -> Ratio on day 4 = 100 * 2 / avg(1, 1, 2) = 150;
    # Ratio on day 3 = 100; Momentum on day 4 = 100 * 150 / 100 = 150 -> Leading.
    days = trading_days(4)
    bench = series(days, [10, 10, 10, 10])
    index = series(days, [10, 10, 10, 20])
    s = rot.scores(index, bench, n=3, k=1)
    assert [x.date for x in s] == [days[3]]
    assert s[0].rs == pytest.approx(2)
    assert s[0].ratio == pytest.approx(150)
    assert s[0].momentum == pytest.approx(150)
    assert s[0].quadrant == rot.LEADING


def accelerating(n: int, step: float) -> list[float]:
    """A price whose daily change grows by `step` each day (negative step: a deepening fall)."""
    out, v = [], 100.0
    for i in range(n):
        v *= 1 + step * i
        out.append(v)
    return out


def test_outperformer_ends_leading_and_underperformer_lagging():
    days = trading_days(120)
    bench = series(days, [100.0] * 120)
    assert rot.scores(series(days, accelerating(120, 0.0001)), bench)[-1].quadrant == rot.LEADING
    assert rot.scores(series(days, accelerating(120, -0.0001)), bench)[-1].quadrant == rot.LAGGING


def test_a_steady_trend_settles_on_the_momentum_line():
    # A constant rate of out- or under-performance gives a constant Ratio, so Momentum tends to
    # exactly 100: the point sits on the horizontal line. Quadrant moves need a change in pace.
    days = trading_days(200)
    bench = series(days, [100.0] * 200)
    up = rot.scores(series(days, [100 * 1.004**i for i in range(200)]), bench)[-1]
    down = rot.scores(series(days, [100 * 0.996**i for i in range(200)]), bench)[-1]
    assert up.ratio > 100 > down.ratio
    assert up.momentum == pytest.approx(100, abs=1e-6) and down.momentum == pytest.approx(100, abs=1e-6)


def test_peak_and_fade_walks_leading_then_weakening():
    days = trading_days(160)
    bench = series(days, [100.0] * 160)
    vals, v = [], 100.0
    for i in range(160):
        v *= 1.006 if i < 110 else 0.998  # strong run, then a gentle fade that stays above average for a while
        vals.append(v)
    q = [x.quadrant for x in rot.scores(series(days, vals), bench)]
    assert rot.LEADING in q
    first_weak = q.index(rot.WEAKENING)
    assert rot.LEADING in q[:first_weak]
    assert rot.LAGGING not in q[:first_weak]  # clockwise: it weakens before it lags


def test_missing_days_are_skipped_not_filled():
    days = trading_days(70)
    bench = series(days, [100.0] * 70)
    index = series(days, [100.0] * 70)
    del index[days[30]]  # index has no close that day
    del bench[days[40]]  # benchmark has none on another
    rs = rot.relative_strength(index, bench)
    assert len(rs) == 68
    assert days[30] not in dict(rs) and days[40] not in dict(rs)
    assert len(rot.scores(index, bench)) == 68 - rot.min_history() + 1


def test_not_enough_history():
    days = trading_days(rot.min_history() - 1)
    bench = series(days, [100.0] * len(days))
    assert rot.scores(bench, bench) == []
    r = rot.row("nifty-it", bench, bench)
    assert r.quadrant is None and "not enough data" in r.note


def test_zero_or_missing_closes_are_ignored():
    days = trading_days(3)
    assert rot.relative_strength({days[0]: 0.0, days[1]: 5.0}, {days[0]: 1.0, days[1]: 1.0}) == [(days[1], 5.0)]


def test_weekly_takes_the_last_trading_day_and_tail_has_8_points():
    days = trading_days(200)
    bench = series(days, [100.0] * 200)
    index = series(days, [100 * 1.002**i for i in range(200)])
    w = rot.weekly(rot.scores(index, bench))
    assert all(p.date.weekday() == 4 for p in w[:-1])  # Fridays (no holidays in this series)
    assert len({(p.date.isocalendar()[0], p.date.isocalendar()[1]) for p in w}) == len(w)
    r = rot.row("x", index, bench)
    assert len(r.tail) == rot.TAIL_WEEKS and r.tail[-1].date == r.as_of == days[-1]
    assert r.ratio_change_4w == pytest.approx(r.ratio - w[-5].ratio)


def test_table_leaves_out_the_benchmark_and_sorts_clockwise():
    days = trading_days(120)
    bench = series(days, [100.0] * 120)
    prices = {
        "bench": bench,
        "up": series(days, accelerating(120, 0.0001)),
        "down": series(days, accelerating(120, -0.0001)),
        "new": series(days[-10:], [100.0] * 10),
    }
    t = rot.table(prices, "bench")
    assert [r.key for r in t] == ["up", "down", "new"]
    assert t[-1].quadrant is None
    with pytest.raises(KeyError):
        rot.table(prices, "missing")
