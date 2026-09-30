"""Backtest of the regime rule (Week 2, Day 7).

The rule reads a weekly signal: the cyclical group's Ratio minus the defensive group's, and how
many Nifty 500 stocks are above their 50-day average. This module replays it over stored weeks and
asks, for each setting of the two cut-offs, what the cyclical group did against the defensive group
over the following 4 and 8 weeks.

    outcome      cyclical group's return minus defensive group's over the next `h` weeks, in points
                 (each group is its indices' average return, equal weight)
    call         a week labelled Cyclical lead or Defensive lead; Neutral makes no call
    hit          Cyclical lead followed by a positive outcome, or Defensive lead by a negative one
    hit rate     hits / calls
    base rate    share of all weeks in which the cyclical group beat the defensive one: what a
                 coin weighted that way would score, so a hit rate only counts above it
    flip rate    label changes between consecutive weeks / weeks: lower means a steadier signal
    edge         average outcome after Cyclical lead minus average outcome after Defensive lead

Weekly outcomes over 4 or 8 weeks overlap, so three years (about 145 weeks) carry far fewer
independent readings than rows. Read the table for which settings are clearly worse, not for a
precise winner. Pure functions, no network.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Mapping, Sequence

from .breadth import CYCLICAL_LEAD, DEFENSIVE_LEAD, classify

HORIZONS = (4, 8)
THRESHOLDS = (1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0)
BREADTHS = (0.0, 40.0, 45.0, 50.0, 55.0, 60.0)  # 0 means the breadth condition is off

MIN_CALLS = 20
MAX_FLIP_RATE = 0.20


@dataclass(frozen=True)
class Week:
    date: date
    spread: float
    market_breadth: float | None
    fwd: Mapping[int, float | None]  # weeks ahead -> outcome, None when not yet known


@dataclass(frozen=True)
class Result:
    threshold: float
    breadth_min: float
    horizon: int
    weeks: int  # weeks with a known outcome
    calls: int
    cyclical_calls: int
    defensive_calls: int
    hits: int
    hit_rate: float | None
    first_half: float | None  # hit rate in the earlier half of the weeks
    second_half: float | None
    edge: float | None
    coverage: float  # calls / weeks
    flip_rate: float  # over all weeks, not only those with an outcome


def group_return(prices: Mapping[str, Mapping[date, float]], keys: Sequence[str],
                 start: date, end: date) -> float | None:
    """Average percentage return of the group's indices between two dates, on the indices that
    have a close on both. None when fewer than half of the group does."""
    rets = []
    for k in keys:
        s = prices.get(k, {})
        a, b = s.get(start), s.get(end)
        if a is not None and b is not None and a > 0:
            rets.append(100 * (b / a - 1))
    if len(rets) * 2 < len(keys):
        return None
    return sum(rets) / len(rets)


def outcomes(week_dates: Sequence[date], prices: Mapping[str, Mapping[date, float]],
             cyclical: Sequence[str], defensive: Sequence[str],
             horizons: Sequence[int] = HORIZONS) -> dict[date, dict[int, float | None]]:
    """Forward outcome for each week and horizon. `week_dates` are consecutive weekly dates, sorted."""
    out: dict[date, dict[int, float | None]] = {}
    for i, d in enumerate(week_dates):
        row: dict[int, float | None] = {}
        for h in horizons:
            j = i + h
            if j >= len(week_dates):
                row[h] = None
                continue
            c = group_return(prices, cyclical, d, week_dates[j])
            f = group_return(prices, defensive, d, week_dates[j])
            row[h] = None if c is None or f is None else c - f
        out[d] = row
    return out


def _rate(hits: int, calls: int) -> float | None:
    return None if calls == 0 else 100 * hits / calls


def evaluate(weeks: Sequence[Week], threshold: float, breadth_min: float, horizon: int) -> Result:
    labels = [classify(w.spread, w.market_breadth, threshold, breadth_min) for w in weeks]
    flips = sum(1 for a, b in zip(labels, labels[1:]) if a != b)
    flip_rate = flips / max(len(labels) - 1, 1)

    known = [(w, lab) for w, lab in zip(weeks, labels) if w.fwd.get(horizon) is not None]
    half = len(known) // 2
    cyc: list[float] = []
    dfn: list[float] = []
    hits = [0, 0]      # earlier half, later half
    calls = [0, 0]
    for idx, (w, lab) in enumerate(known):
        if lab not in (CYCLICAL_LEAD, DEFENSIVE_LEAD):
            continue
        out = w.fwd[horizon]
        assert out is not None
        part = 0 if idx < half else 1
        calls[part] += 1
        if lab == CYCLICAL_LEAD:
            cyc.append(out)
            hits[part] += out > 0
        else:
            dfn.append(out)
            hits[part] += out < 0
    n_calls = calls[0] + calls[1]
    edge = sum(cyc) / len(cyc) - sum(dfn) / len(dfn) if cyc and dfn else None
    return Result(threshold, breadth_min, horizon, len(known), n_calls, len(cyc), len(dfn),
                  hits[0] + hits[1], _rate(hits[0] + hits[1], n_calls),
                  _rate(hits[0], calls[0]), _rate(hits[1], calls[1]), edge,
                  n_calls / len(known) if known else 0.0, flip_rate)


def base_rate(weeks: Sequence[Week], horizon: int) -> float | None:
    """Percent of weeks in which the cyclical group beat the defensive group over `horizon` weeks."""
    outs = [w.fwd[horizon] for w in weeks if w.fwd.get(horizon) is not None]
    return None if not outs else 100 * sum(o > 0 for o in outs) / len(outs)


def grid(weeks: Sequence[Week], thresholds: Sequence[float] = THRESHOLDS,
         breadths: Sequence[float] = BREADTHS, horizons: Sequence[int] = HORIZONS) -> list[Result]:
    return [evaluate(weeks, t, b, h) for t in thresholds for b in breadths for h in horizons]


def recommend(results: Sequence[Result], horizons: Sequence[int] = HORIZONS,
              min_calls: int = MIN_CALLS, max_flip: float = MAX_FLIP_RATE) -> tuple[float, float] | None:
    """The (threshold, breadth_min) with the best average hit rate across the horizons, among
    settings that make at least `min_calls` calls at every horizon, flip no more than `max_flip`
    of weeks, and hit at least half the time in both halves of history. Ties go to the steadier
    signal, then the lower threshold. None when no setting qualifies."""
    by_setting: dict[tuple[float, float], list[Result]] = {}
    for r in results:
        by_setting.setdefault((r.threshold, r.breadth_min), []).append(r)
    best: tuple[tuple[float, float, float], tuple[float, float]] | None = None
    for setting, rs in by_setting.items():
        if {r.horizon for r in rs} != set(horizons):
            continue
        ok = all(r.calls >= min_calls and r.hit_rate is not None and r.first_half is not None
                 and r.second_half is not None and r.first_half >= 50 and r.second_half >= 50
                 for r in rs) and rs[0].flip_rate <= max_flip
        if not ok:
            continue
        key = (sum(r.hit_rate for r in rs) / len(rs), -rs[0].flip_rate, -setting[0])  # type: ignore[misc]
        if best is None or key > best[0]:
            best = (key, setting)
    return best[1] if best else None
