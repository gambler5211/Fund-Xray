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

Steady labels: many indices sit within a fraction of a point of 100, where the raw quadrant flips
back and forth on noise (99.99 is Lagging, 100.06 Leading). So each score also carries a `settled`
quadrant: an index keeps its side of each line until it crosses by more than NEUTRAL_BAND points.
`quadrant` stays the raw reading; the page shows `settled` and greys points within the band.
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
NEUTRAL_BAND = 0.5  # points either side of 100 that don't change a settled label; Day 7 tunes it


@dataclass(frozen=True)
class Score:
    date: date
    rs: float
    ratio: float
    momentum: float
    quadrant: str
    settled: str | None = None  # the steady label (see NEUTRAL_BAND); None only when built by hand

    @property
    def label(self) -> str:
        return self.settled or self.quadrant


@dataclass(frozen=True)
class RotationRow:
    """One index on this week's chart. `quadrant` is None when there isn't enough history."""

    key: str
    as_of: date | None
    ratio: float | None
    momentum: float | None
    quadrant: str | None  # the settled label
    tail: list[Score] = field(default_factory=list)  # oldest first, ends at as_of
    ratio_change_4w: float | None = None
    note: str | None = None


def quadrant(ratio: float, momentum: float) -> str:
    if ratio >= 100:
        return LEADING if momentum >= 100 else WEAKENING
    return IMPROVING if momentum >= 100 else LAGGING


def near_line(ratio: float, momentum: float, band: float = NEUTRAL_BAND) -> bool:
    """Within the band of either line: the reading can't tell the quadrants apart."""
    return abs(ratio - 100) < band or abs(momentum - 100) < band


def settle(sides: tuple[bool, bool] | None, ratio: float, momentum: float,
           band: float = NEUTRAL_BAND) -> tuple[bool, bool]:
    """(ahead, gaining) after this reading, given the sides held before it. Starts from the raw
    sides; after that a side changes only when the reading is more than `band` past the line."""
    if sides is None:
        return ratio >= 100, momentum >= 100
    ahead, gaining = sides
    if ahead and ratio < 100 - band or not ahead and ratio >= 100 + band:
        ahead = not ahead
    if gaining and momentum < 100 - band or not gaining and momentum >= 100 + band:
        gaining = not gaining
    return ahead, gaining


def sides_quadrant(ahead: bool, gaining: bool) -> str:
    return quadrant(100 if ahead else 99, 100 if gaining else 99)


def min_history(n: int = DEFAULT_N, k: int = DEFAULT_K) -> int:
    """Shared trading days needed before the first score: n for the average, then k more for momentum."""
    return n + k


def relative_strength(index: Mapping[date, float], bench: Mapping[date, float]) -> list[tuple[date, float]]:
    """(date, index / benchmark) on the days both have a positive close, oldest first."""
    days = sorted(d for d in index.keys() & bench.keys() if index[d] and bench[d] and index[d] > 0 and bench[d] > 0)
    return [(d, index[d] / bench[d]) for d in days]


def scores(index: Mapping[date, float], bench: Mapping[date, float], n: int = DEFAULT_N, k: int = DEFAULT_K,
           band: float = NEUTRAL_BAND) -> list[Score]:
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
    sides = None
    for j in range(k, len(ratios)):
        d, r, ratio = ratios[j]
        momentum = 100 * ratio / ratios[j - k][2]
        sides = settle(sides, ratio, momentum, band)
        out.append(Score(d, r, ratio, momentum, quadrant(ratio, momentum), sides_quadrant(*sides)))
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
    note = "on the line" if near_line(now.ratio, now.momentum) else None
    return RotationRow(key, now.date, now.ratio, now.momentum, now.label, tail=w[-tail_weeks:],
                       ratio_change_4w=change, note=note)


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
