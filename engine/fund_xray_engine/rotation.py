"""Rotation quadrants: where each sector index stands against a benchmark, and which way it's moving.

For an index and a benchmark with daily closes:

    RS_t       = index close / benchmark close
    Ratio_t    = 100 * RS_t / (average of RS over the last n trading days)
    Momentum_t = 100 * Ratio_t / Ratio_(t-k)

    Leading    Ratio >= 100, Momentum >= 100   beating the benchmark and gaining
    Weakening  Ratio >= 100, Momentum <  100   still ahead, losing steam
    Lagging    Ratio <  100, Momentum <  100   behind and falling further
    Improving  Ratio <  100, Momentum >= 100   behind but catching up

This is an open approximation of relative rotation charts, not the proprietary RRG/JdK maths,
so it is called "rotation quadrants". Pure functions, no network, no dependencies.

Gaps: only days on which both the index and the benchmark have a close are used. A day missing
for one of them is skipped, never filled with a guess, and n and k count those shared days.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Iterable, Mapping, Sequence

LEADING, WEAKENING, LAGGING, IMPROVING = "Leading", "Weakening", "Lagging", "Improving"
QUADRANTS = (LEADING, WEAKENING, LAGGING, IMPROVING)

DEFAULT_N = 50  # trading days in the RS average
DEFAULT_K = 10  # trading days back for momentum
TAIL_WEEKS = 8


@dataclass(frozen=True)
class Score:
    date: date
    rs: float
    ratio: float
    momentum: float
    quadrant: str


@dataclass(frozen=True)
class RotationRow:
    """One index on this week's chart. `quadrant` is None when there isn't enough history."""

    key: str
    as_of: date | None
    ratio: float | None
    momentum: float | None
    quadrant: str | None
    tail: list[Score] = field(default_factory=list)  # oldest first, ends at as_of
    ratio_change_4w: float | None = None
    note: str | None = None


def quadrant(ratio: float, momentum: float) -> str:
    if ratio >= 100:
        return LEADING if momentum >= 100 else WEAKENING
    return IMPROVING if momentum >= 100 else LAGGING


def min_history(n: int = DEFAULT_N, k: int = DEFAULT_K) -> int:
    """Shared trading days needed before the first score: n for the average, then k more for momentum."""
    return n + k


def relative_strength(index: Mapping[date, float], bench: Mapping[date, float]) -> list[tuple[date, float]]:
    """(date, index / benchmark) on the days both have a positive close, oldest first."""
    days = sorted(d for d in index.keys() & bench.keys() if index[d] and bench[d] and index[d] > 0 and bench[d] > 0)
    return [(d, index[d] / bench[d]) for d in days]


def scores(index: Mapping[date, float], bench: Mapping[date, float], n: int = DEFAULT_N, k: int = DEFAULT_K) -> list[Score]:
    """Daily scores, oldest first. Empty when there are fewer than n + k shared days."""
    if n < 1 or k < 1:
        raise ValueError("n and k must be at least 1")
    rs = relative_strength(index, bench)
    if len(rs) < min_history(n, k):
        return []

    ratios: list[tuple[date, float, float]] = []  # (date, rs, ratio)
    window = sum(v for _, v in rs[:n])
    for i in range(n - 1, len(rs)):
        if i >= n:
            window += rs[i][1] - rs[i - n][1]
        avg = window / n
        ratios.append((rs[i][0], rs[i][1], 100 * rs[i][1] / avg))

    out = []
    for j in range(k, len(ratios)):
        d, r, ratio = ratios[j]
        momentum = 100 * ratio / ratios[j - k][2]
        out.append(Score(d, r, ratio, momentum, quadrant(ratio, momentum)))
    return out


def weekly(daily: Sequence[Score]) -> list[Score]:
    """The last score of each calendar week (Monday to Sunday), oldest first."""
    last: dict[tuple[int, int], Score] = {}
    for s in daily:
        iso = s.date.isocalendar()
        last[(iso[0], iso[1])] = s
    return [last[w] for w in sorted(last)]


def row(key: str, index: Mapping[date, float], bench: Mapping[date, float],
        n: int = DEFAULT_N, k: int = DEFAULT_K, tail_weeks: int = TAIL_WEEKS) -> RotationRow:
    """This week's point for one index, with its tail and the change in Ratio over 4 weeks."""
    w = weekly(scores(index, bench, n, k))
    if not w:
        shared = len(relative_strength(index, bench))
        return RotationRow(key, None, None, None, None, note=f"not enough data ({shared} of {min_history(n, k)} trading days)")
    now = w[-1]
    change = now.ratio - w[-5].ratio if len(w) >= 5 else None
    return RotationRow(key, now.date, now.ratio, now.momentum, now.quadrant, tail=w[-tail_weeks:], ratio_change_4w=change)


def table(prices: Mapping[str, Mapping[date, float]], benchmark: str, keys: Iterable[str] | None = None,
          n: int = DEFAULT_N, k: int = DEFAULT_K) -> list[RotationRow]:
    """Rows for every index against the benchmark (the benchmark itself left out), strongest first:
    by quadrant in clockwise order from Leading, then by Ratio."""
    bench = prices.get(benchmark)
    if not bench:
        raise KeyError(f"no prices for the benchmark {benchmark!r}")
    rows = [row(key, prices.get(key, {}), bench, n, k) for key in (keys or prices) if key != benchmark]
    order = {q: i for i, q in enumerate(QUADRANTS)}
    return sorted(rows, key=lambda r: (r.quadrant is None, order.get(r.quadrant, 9), -(r.ratio or 0)))
