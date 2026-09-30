from datetime import date, timedelta

import pytest

from fund_xray_engine import indicators as ind


def test_hand_worked_rsi_on_a_short_window():
    # n = 3 so it can be checked by hand. Changes: +2, -1, +1, then +3, -2.
    closes = [10, 12, 11, 12, 15, 13]
    # first averages over +2, -1, +1: gain 1.0, loss 1/3
    # +3: gain (1.0*2 + 3)/3 = 5/3, loss (1/3*2 + 0)/3 = 2/9
    # -2: gain (5/3*2 + 0)/3 = 10/9, loss (2/9*2 + 2)/3 = 22/27
    rs = (10 / 9) / (22 / 27)
    assert ind.rsi(closes, n=3) == pytest.approx(100 - 100 / (1 + rs))


def test_rising_every_day_is_100_and_flat_is_50():
    assert ind.rsi([float(x) for x in range(1, 30)]) == 100.0
    assert ind.rsi([5.0] * 30) == 50.0


def test_falling_every_day_is_0():
    assert ind.rsi([float(x) for x in range(30, 1, -1)]) == pytest.approx(0.0)


def test_too_few_closes_is_none():
    assert ind.rsi([1.0] * 14) is None
    assert ind.rsi([1.0] * 15) == 50.0


def test_equal_ups_and_downs_read_50():
    closes = [100.0 + (1 if i % 2 else 0) for i in range(40)]
    assert ind.rsi(closes) == pytest.approx(50.0, abs=5)  # ends on an up day, so a little above 50


def test_latest_rsi_sorts_by_date():
    d0 = date(2026, 1, 1)
    prices = {d0 + timedelta(days=i): float(30 - i) for i in range(20)}
    d, v = ind.latest_rsi(dict(reversed(list(prices.items()))))
    assert d == d0 + timedelta(days=19) and v == pytest.approx(0.0)


def test_words_describe_the_move_only():
    assert ind.rsi_words(78) == "up hard over the last few weeks"
    assert ind.rsi_words(50) == "moving sideways over the last few weeks"
    assert ind.rsi_words(22) == "down hard over the last few weeks"
    for v in range(0, 101, 5):
        w = ind.rsi_words(v)
        assert "overbought" not in w and "oversold" not in w and "buy" not in w and "sell" not in w
