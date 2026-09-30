"""Alignment: how your money lines up with the sector rotation (Week 3, Day 1).

Each holding goes to a sector, each sector to its closest NSE index, and each index has a
quadrant that week against your benchmark. Your alignment is your money by quadrant:

    gaining   Leading + Improving   sectors whose strength against the benchmark is rising
    losing    Weakening + Lagging   sectors whose strength is falling
    unmapped  sectors with no index, funds and ETFs, and stocks without a sector

The change from last week splits in two, so you can tell the market's doing from yours:

    from sectors   this week's holdings, this week's quadrants  minus  the same holdings, last week's quadrants
    from you       whatever is left: buying, selling, and prices moving your weights

The market's split counts the Nifty 500's stocks by the quadrant of their sector. NSE's lists
carry no weights, so it is a count of stocks, not of money. Pure functions, no network.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence

from .rotation import IMPROVING, LAGGING, LEADING, QUADRANTS, WEAKENING

FUNDS = "ETFs & funds"
GAINING = (LEADING, IMPROVING)
LOSING = (WEAKENING, LAGGING)


@dataclass(frozen=True)
class Holding:
    exchange: str
    symbol: str
    isin: str | None
    name: str
    value: float


@dataclass(frozen=True)
class Placed:
    symbol: str
    name: str
    value: float
    share: float  # % of the portfolio
    industry: str | None
    index_key: str | None


@dataclass(frozen=True)
class Split:
    leading: float
    improving: float
    weakening: float
    lagging: float
    unmapped: float

    @property
    def gaining(self) -> float:
        return self.leading + self.improving

    @property
    def losing(self) -> float:
        return self.weakening + self.lagging

    def of(self, quadrant: str) -> float:
        return {LEADING: self.leading, IMPROVING: self.improving, WEAKENING: self.weakening, LAGGING: self.lagging}[quadrant]


def looks_like_fund(symbol: str, name: str) -> bool:
    """ETFs and index funds have no company sector (same rule as the web app's sectorsShared.ts)."""
    s, n = symbol.upper(), f" {name.upper()}"
    return s.endswith("BEES") or s.endswith("ETF") or " ETF" in n or n.endswith(" BEES") or "INDEX FUND" in n


def industry_of(h: Holding, by_isin: Mapping[str, str], by_symbol: Mapping[str, str],
                overrides: Mapping[str, str]) -> str | None:
    """Your own choice first, then NSE's classification by ISIN, then by symbol, then fund detection."""
    own = overrides.get(f"{h.exchange}:{h.symbol}")
    if own:
        return own
    nse = (h.isin and by_isin.get(h.isin)) or by_symbol.get(h.symbol)
    if nse:
        return nse
    return FUNDS if looks_like_fund(h.symbol, h.name) else None


def place(holdings: Sequence[Holding], by_isin: Mapping[str, str], by_symbol: Mapping[str, str],
          overrides: Mapping[str, str], sector_index: Mapping[str, str]) -> list[Placed]:
    """Each holding with its share of the portfolio, its sector and the sector's index."""
    total = sum(h.value for h in holdings)
    out = []
    for h in holdings:
        ind = industry_of(h, by_isin, by_symbol, overrides)
        out.append(Placed(h.symbol, h.name, h.value, 100 * h.value / total if total else 0.0, ind,
                          sector_index.get(ind) if ind else None))
    return sorted(out, key=lambda p: -p.value)


def split(placed: Iterable[Placed], quadrants: Mapping[str, str]) -> Split:
    """Money by quadrant. A holding whose index has no quadrant that week counts as unmapped."""
    by = {q: 0.0 for q in QUADRANTS}
    unmapped = 0.0
    for p in placed:
        q = quadrants.get(p.index_key) if p.index_key else None
        if q in by:
            by[q] += p.share
        else:
            unmapped += p.share
    return Split(by[LEADING], by[IMPROVING], by[WEAKENING], by[LAGGING], unmapped)


def market_split(members: Iterable[str | None], sector_index: Mapping[str, str],
                 quadrants: Mapping[str, str]) -> tuple[int, Split] | None:
    """Share of stocks (by count) in each quadrant, from each stock's sector. Stocks whose sector has
    no index, or no quadrant that week, are left out; None when none are left."""
    by = {q: 0 for q in QUADRANTS}
    for ind in members:
        key = sector_index.get(ind) if ind else None
        q = quadrants.get(key) if key else None
        if q in by:
            by[q] += 1
    n = sum(by.values())
    if not n:
        return None
    pct = {q: 100 * c / n for q, c in by.items()}
    return n, Split(pct[LEADING], pct[IMPROVING], pct[WEAKENING], pct[LAGGING], 0.0)


@dataclass(frozen=True)
class Change:
    total: float        # gaining now minus gaining last week, in points
    from_sectors: float  # the part from quadrants moving under this week's holdings
    from_you: float      # the rest: trades and price moves in your weights


def change(now: Split, last_week: Split | None, now_if_still: Split) -> Change | None:
    """How the gaining share moved since last week. `now_if_still` is this week's holdings with last
    week's quadrants. None without a record of last week."""
    if last_week is None:
        return None
    total = now.gaining - last_week.gaining
    from_sectors = now.gaining - now_if_still.gaining
    return Change(total, from_sectors, total - from_sectors)
