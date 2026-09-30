"""Breadth, narrow moves and the market regime (Week 2, Day 4).

Breadth asks how many of an index's stocks are taking part in its move:

    pct_above_avg   share of members whose price is above its 50-day average
    pct_up          share of members with a positive return over the last 20 trading days
    ew_return       the members' average return over those 20 days (equal weight)
    index_return    the index's own return over the same days (weighted by company size)
    spread          index_return - ew_return, in points
    narrow          |spread| > NARROW_POINTS: a few large stocks carried (or dragged) the index

Prices are adjusted for splits and bonuses by chaining NSE's daily ratio close / previous close,
since NSE adjusts the previous close on the ex-date. A 1:2 split then reads as no change, not a
50% fall. Days that look like bad data (a ratio outside 0.2 to 5) are left out of the chain.

Membership is today's list from NSE, applied to past weeks too, so older breadth leaves out
stocks that have since dropped out of an index. Good enough for weekly context, not for research.

The regime compares the cyclical and defensive groups' Ratios against the Nifty 500:

    Cyclical lead   cyclical average - defensive average > +REGIME_THRESHOLD and market breadth > REGIME_BREADTH
    Defensive lead  that difference < -REGIME_THRESHOLD
    Neutral         otherwise

Starting values from the plan; Day 7 backtests and tunes them. Pure functions, no network.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Iterable, Mapping, Sequence

AVG_DAYS = 50
RETURN_DAYS = 20  # about 4 weeks, matching the table's "Ratio vs 4 weeks ago"
NARROW_POINTS = 3.0
MIN_MEMBERS = 5  # fewer priced members than this and breadth isn't reported

CYCLICAL = ("nifty-bank", "nifty-auto", "nifty-metal", "nifty-realty", "nifty-infra", "nifty-pse")
DEFENSIVE = ("nifty-fmcg", "nifty-pharma", "nifty-healthcare")
REGIME_THRESHOLD = 2.0
REGIME_BREADTH = 50.0  # % of Nifty 500 stocks above their 50-day average
CYCLICAL_LEAD, DEFENSIVE_LEAD, NEUTRAL = "Cyclical lead", "Defensive lead", "Neutral"

_SANE = (0.2, 5.0)


@dataclass(frozen=True)
class StockDay:
    date: date
    close: float
    prev_close: float | None


@dataclass(frozen=True)
class Breadth:
    date: date
    members: int  # members with enough history to count
    pct_above_avg: float
    pct_up: float
    ew_return: float
    index_return: float | None
    spread: float | None
    narrow: bool


@dataclass(frozen=True)
class Regime:
    date: date
    cyclical: float
    defensive: float
    spread: float
    market_breadth: float | None
    regime: str


def adjusted(days: Sequence[StockDay]) -> dict[date, float]:
    """A price series adjusted for splits and bonuses, on the scale of the first close.
    Each day moves the level by close / previous close; the first day, or a day with no usable
    previous close, starts from (or keeps) the level rather than jumping to the raw close."""
    out: dict[date, float] = {}
    level: float | None = None
    for d in sorted(days, key=lambda x: x.date):
        if d.close is None or d.close <= 0:
            continue
        if level is None:
            level = d.close
        elif d.prev_close and d.prev_close > 0 and _SANE[0] < d.close / d.prev_close < _SANE[1]:
            level *= d.close / d.prev_close
        out[d.date] = level
    return out


def _ret(series: Mapping[date, float], days: Sequence[date], i: int, back: int) -> float | None:
    """Percentage return from `back` trading days before days[i] to days[i], on the dates both have prices."""
    if i - back < 0:
        return None
    a, b = series.get(days[i - back]), series.get(days[i])
    if a is None or b is None or a <= 0:
        return None
    return 100 * (b / a - 1)


def breadth(members: Mapping[str, Mapping[date, float]], index: Mapping[date, float] | None,
            on: Iterable[date], calendar: Sequence[date],
            avg_days: int = AVG_DAYS, return_days: int = RETURN_DAYS,
            narrow_points: float = NARROW_POINTS) -> list[Breadth]:
    """Breadth on each date in `on`. `calendar` is every trading day (sorted); `members` maps each
    stock to its adjusted closes. A member counts on a date only if it has a close that day, on the
    day `return_days` earlier, and on at least 90% of the last `avg_days` trading days (a day or two
    without trades doesn't drop it)."""
    pos = {d: i for i, d in enumerate(calendar)}
    out: list[Breadth] = []
    for d in on:
        i = pos.get(d)
        if i is None or i < max(avg_days - 1, return_days):
            continue
        window = calendar[i - avg_days + 1:i + 1]
        above = up = n = 0
        rets: list[float] = []
        for series in members.values():
            px = [series[w] for w in window if w in series]
            if len(px) < 0.9 * avg_days or d not in series:
                continue
            r = _ret(series, calendar, i, return_days)
            if r is None:
                continue
            n += 1
            above += series[d] > sum(px) / len(px)
            up += r > 0
            rets.append(r)
        if n < MIN_MEMBERS:
            continue
        ew = sum(rets) / n
        ir = _ret(index, calendar, i, return_days) if index else None
        spread = ir - ew if ir is not None else None
        out.append(Breadth(d, n, 100 * above / n, 100 * up / n, ew, ir, spread,
                           spread is not None and abs(spread) > narrow_points))
    return out


def classify(spread: float, market_breadth: float | None,
             threshold: float = REGIME_THRESHOLD, breadth_min: float = REGIME_BREADTH) -> str:
    """The regime label for one week from the group spread and market breadth. One place for the
    rule, so the nightly job and the backtest can't drift apart."""
    if spread > threshold and market_breadth is not None and market_breadth > breadth_min:
        return CYCLICAL_LEAD
    if spread < -threshold:
        return DEFENSIVE_LEAD
    return NEUTRAL


def regime(ratios: Mapping[str, float], market_breadth: float | None, on: date,
           threshold: float = REGIME_THRESHOLD, breadth_min: float = REGIME_BREADTH,
           cyclical: Sequence[str] = CYCLICAL, defensive: Sequence[str] = DEFENSIVE) -> Regime | None:
    """The regime for one week from each index's Ratio against the Nifty 500. None when fewer than
    half of either group has a Ratio that week."""
    cyc = [ratios[k] for k in cyclical if k in ratios]
    dfn = [ratios[k] for k in defensive if k in ratios]
    if len(cyc) * 2 < len(cyclical) or len(dfn) * 2 < len(defensive):
        return None
    c, f = sum(cyc) / len(cyc), sum(dfn) / len(dfn)
    spread = c - f
    return Regime(on, c, f, spread, market_breadth, classify(spread, market_breadth, threshold, breadth_min))


def week_ends(calendar: Sequence[date]) -> list[date]:
    """The last trading day of each calendar week in `calendar`."""
    last: dict[tuple[int, int], date] = {}
    for d in calendar:
        iso = d.isocalendar()
        last[(iso[0], iso[1])] = max(d, last.get((iso[0], iso[1]), d))
    return [last[w] for w in sorted(last)]
