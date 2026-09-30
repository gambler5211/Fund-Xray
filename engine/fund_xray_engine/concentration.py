"""How spread out a portfolio really is (Week 3, Day 2).

    effective holdings   1 / sum of squared weights. Ten equal holdings read 10; one holding at
                         50% with nine small ones reads about 3.6. It counts sizes, not behaviour.
    clusters             holdings whose weekly returns move together: correlation above
                         CLUSTER_CORRELATION over the last year. Two private banks usually land in
                         one cluster; a bank and a pharma company usually don't.
    effective bets       the same formula as effective holdings, over clusters instead of stocks:
                         how many separate bets your money really sits in

Returns are weekly (each week's last close, adjusted for splits and bonuses) over the last
CORRELATION_WEEKS weeks. A holding with fewer than MIN_WEEKS weekly returns can't be grouped; it
is listed as left out and counted as a bet of its own, so effective bets never looks better for
missing data. Clustering is average linkage: two groups join only when their stocks' average
correlation with each other is above the cut-off, so one chain of look-alikes can't pull
unrelated stocks together. Pure functions, no network.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date
from typing import Mapping, Sequence

CORRELATION_WEEKS = 52
MIN_WEEKS = 26
CLUSTER_CORRELATION = 0.6


@dataclass(frozen=True)
class Cluster:
    symbols: tuple[str, ...]  # biggest holding first
    share: float  # % of the portfolio
    correlation: float | None  # average pairwise correlation inside the cluster; None for one stock


@dataclass(frozen=True)
class Concentration:
    holdings: int
    effective_holdings: float
    effective_bets: float
    clusters: tuple[Cluster, ...]  # biggest first; left-out holdings are not in any cluster
    left_out: tuple[str, ...]  # too little price history to group
    weeks: int  # weekly returns in the window


def effective_count(shares: Sequence[float]) -> float:
    """1 / sum of squared weights, from shares in any unit (they are normalised)."""
    total = sum(s for s in shares if s > 0)
    if total <= 0:
        return 0.0
    return 1 / sum((s / total) ** 2 for s in shares if s > 0)


def weekly_closes(prices: Mapping[date, float]) -> dict[tuple[int, int], float]:
    """The last close of each ISO week."""
    out: dict[tuple[int, int], tuple[date, float]] = {}
    for d, p in prices.items():
        k = tuple(d.isocalendar()[:2])
        if k not in out or d > out[k][0]:
            out[k] = (d, p)
    return {k: v[1] for k, v in out.items()}


def weekly_returns(prices: Mapping[date, float], weeks: Sequence[tuple[int, int]]) -> dict[tuple[int, int], float]:
    """Return for each week in `weeks` (sorted) whose previous week also has a close."""
    closes = weekly_closes(prices)
    out = {}
    for prev, cur in zip(weeks, weeks[1:]):
        a, b = closes.get(prev), closes.get(cur)
        if a and b and a > 0:
            out[cur] = b / a - 1
    return out


def correlation(a: Mapping, b: Mapping, min_points: int = MIN_WEEKS) -> float | None:
    """Pearson correlation on the keys both have; None with too few points or a flat series."""
    keys = [k for k in a if k in b]
    if len(keys) < min_points:
        return None
    xs, ys = [a[k] for k in keys], [b[k] for k in keys]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    sx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    sy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if sx == 0 or sy == 0:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (sx * sy)


def clusters(returns: Mapping[str, Mapping], cut: float = CLUSTER_CORRELATION,
             min_points: int = MIN_WEEKS) -> list[tuple[list[str], float | None]]:
    """Average-linkage groups of symbols whose returns correlate above `cut`. A pair without enough
    common weeks counts as uncorrelated (0). Returns [(symbols, average inside correlation)]."""
    syms = sorted(returns)
    corr: dict[tuple[str, str], float] = {}
    for i, a in enumerate(syms):
        for b in syms[i + 1:]:
            c = correlation(returns[a], returns[b], min_points)
            corr[(a, b)] = corr[(b, a)] = 0.0 if c is None else c
    groups = [[s] for s in syms]

    def link(g: list[str], h: list[str]) -> float:
        return sum(corr[(x, y)] for x in g for y in h) / (len(g) * len(h))

    while len(groups) > 1:
        best, pair = cut, None
        for i in range(len(groups)):
            for j in range(i + 1, len(groups)):
                v = link(groups[i], groups[j])
                if v > best:
                    best, pair = v, (i, j)
        if pair is None:
            break
        i, j = pair
        groups[i] = groups[i] + groups[j]
        del groups[j]

    out = []
    for g in groups:
        pairs = [corr[(x, y)] for k, x in enumerate(g) for y in g[k + 1:]]
        out.append((g, sum(pairs) / len(pairs) if pairs else None))
    return out


def concentration(shares: Mapping[str, float], prices: Mapping[str, Mapping[date, float]],
                  weeks: Sequence[tuple[int, int]], cut: float = CLUSTER_CORRELATION,
                  min_weeks: int = MIN_WEEKS) -> Concentration:
    """`shares` maps each holding to its % of the portfolio; `prices` maps symbols to adjusted
    daily closes; `weeks` are the ISO weeks of the window, oldest first."""
    rets = {s: weekly_returns(prices.get(s, {}), weeks) for s in shares}
    usable = {s: r for s, r in rets.items() if len(r) >= min_weeks}
    left_out = tuple(sorted((s for s in shares if s not in usable), key=lambda s: -shares[s]))
    groups = []
    for syms, avg in clusters(usable, cut, min_weeks):
        syms = sorted(syms, key=lambda s: -shares[s])
        groups.append(Cluster(tuple(syms), sum(shares[s] for s in syms), avg))
    groups.sort(key=lambda c: -c.share)
    bets = effective_count([c.share for c in groups] + [shares[s] for s in left_out])
    return Concentration(len(shares), effective_count(list(shares.values())), bets, tuple(groups), left_out,
                         max(len(weeks) - 1, 0))
