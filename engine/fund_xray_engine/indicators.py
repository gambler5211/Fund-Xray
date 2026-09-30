"""Price indicators (Week 3, Day 4): RSI for now; the 200-day trend joins in Week 4.

RSI(14), Wilder's version, the one charting sites quote:

    change   today's close minus yesterday's
    gain     the change when positive, else 0;  loss  the fall when negative, else 0
    average  the first average is the plain mean of the first 14 gains (and losses); after that
             each day's average = (yesterday's average x 13 + today's value) / 14
    RSI      100 - 100 / (1 + average gain / average loss); 100 when there were no losses,
             50 when the price didn't move at all

It describes how hard the price has moved over the last few weeks; it is not a forecast. The
app words it that way ("up hard over recent weeks"), never "overbought". Pure functions.
"""

from __future__ import annotations

from datetime import date
from typing import Mapping, Sequence

RSI_DAYS = 14


def rsi(closes: Sequence[float], n: int = RSI_DAYS) -> float | None:
    """RSI of the last close in `closes` (oldest first). None with fewer than n + 1 closes."""
    if len(closes) < n + 1:
        return None
    changes = [b - a for a, b in zip(closes, closes[1:])]
    gain = sum(max(c, 0.0) for c in changes[:n]) / n
    loss = sum(max(-c, 0.0) for c in changes[:n]) / n
    for c in changes[n:]:
        gain = (gain * (n - 1) + max(c, 0.0)) / n
        loss = (loss * (n - 1) + max(-c, 0.0)) / n
    if loss == 0:
        return 50.0 if gain == 0 else 100.0
    return 100 - 100 / (1 + gain / loss)


def latest_rsi(prices: Mapping[date, float], n: int = RSI_DAYS) -> tuple[date, float] | None:
    """(last date, RSI) from a date -> close mapping."""
    days = sorted(prices)
    v = rsi([prices[d] for d in days], n)
    return (days[-1], v) if v is not None else None


def rsi_words(v: float) -> str:
    """Plain words for an RSI reading, describing the recent move and nothing more."""
    if v >= 70:
        return "up hard over the last few weeks"
    if v >= 55:
        return "rising over the last few weeks"
    if v > 45:
        return "moving sideways over the last few weeks"
    if v > 30:
        return "falling over the last few weeks"
    return "down hard over the last few weeks"
