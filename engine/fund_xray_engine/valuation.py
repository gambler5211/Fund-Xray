"""Three ways of looking at what a stock's price assumes (Week 3, Day 6). Pure functions.

None of these is a price target, and the app never words them as one. Each view shows its
formula and every input, so a reader can redo it on paper.

P/E history     fair value = TTM EPS x the stock's own median P/E over the stored years, with the
                25th-75th percentile P/E as a range. Weekly P/Es: each week's close (adjusted for
                splits, on today's share count) x today's shares / the TTM profit that had been
                published by that week. Needs at least 26 weeks with positive earnings.
Graham number   sqrt(22.5 x EPS x book value per share). Benjamin Graham's ceiling for a
                defensive buyer (P/E 15 x P/B 1.5). None when either input is zero or negative.
                It reads banks and fast growers harshly: both trade on more than book value.
Reverse DCF     the yearly growth in free cash flow over 10 years that today's market value
                implies, given a discount rate and a growth rate after year 10 (both settings,
                12% and 5% to start). Free cash flow = operating cash flow - capex. Value =
                sum of FCF x (1+g)^t / (1+r)^t for t = 1..10, plus a terminal value of
                FCF_10 x (1+tg) / (r - tg) discounted from year 10. Solved for g by bisection.
                Market value is price x shares; net cash or debt is left out, so cash-rich
                companies look a little more demanding than they are, and indebted ones less.
                Skipped for banks and financial companies (deposits and loans run through their
                cash flow) and when free cash flow is zero or negative.
"""

from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Mapping, Sequence

from . import financials as fin
from .breadth import StockDay, adjusted, week_ends
from .financials import Missing, Row

GRAHAM_MULTIPLE = 22.5
DCF_YEARS = 10
DEFAULT_DISCOUNT = 0.12
DEFAULT_TERMINAL = 0.05
MIN_PE_WEEKS = 26
PUBLISH_LAG_DAYS = 45  # when a filing's date isn't known, assume results were out 45 days after the quarter
GROWTH_LO, GROWTH_HI = -0.5, 1.0
FINANCIAL_SECTORS = ("Financial Services",)
GRAHAM_NOTE = "Reads banks and fast growers harshly: both usually trade well above book value."


def percentile(values: Sequence[float], p: float) -> float:
    """Linear-interpolated percentile (p from 0 to 100) of a non-empty list."""
    v = sorted(values)
    if len(v) == 1:
        return v[0]
    k = (len(v) - 1) * p / 100
    lo, hi = math.floor(k), math.ceil(k)
    return v[lo] + (v[hi] - v[lo]) * (k - lo)


def known_by(r: Row) -> date:
    return r.filed or (r.period_end + timedelta(days=PUBLISH_LAG_DAYS))


def weekly_pe(days: Sequence[StockDay], rows: Sequence[Row]) -> list[tuple[date, float]]:
    """(week end, P/E) for every week with a positive TTM profit published by then."""
    shares = fin.latest_shares(rows)
    adj = adjusted(days)
    if not adj or not shares:
        return []
    raw_last = max(days, key=lambda d: d.date).close
    scale = raw_last / adj[max(adj)]  # puts the adjusted series on today's share basis
    out = []
    for d in week_ends(sorted(adj)):
        published = [r for r in rows if known_by(r) <= d and r.eps_q is not None]
        if not published:
            continue
        p = fin.ttm_profit(rows, as_of=max(r.period_end for r in published))
        if isinstance(p, Missing) or p[1] <= 0:
            continue
        out.append((d, adj[d] * scale * shares / p[1]))
    return out


def pe_view(price: float, days: Sequence[StockDay], rows: Sequence[Row]) -> dict:
    eps = fin.ttm_eps(rows)
    if isinstance(eps, Missing):
        return {"missing": eps.reason}
    end, e = eps
    if e <= 0:
        return {"missing": f"a loss over the 12 months to {end:%b %Y}, so a P/E doesn't apply", "inputs": {"ttm_eps": round(e, 2)}}
    pes = weekly_pe(days, rows)
    if len(pes) < MIN_PE_WEEKS:
        return {"missing": f"only {len(pes)} weeks of P/E history with positive earnings; {MIN_PE_WEEKS} needed",
                "inputs": {"ttm_eps": round(e, 2)}}
    vals = [v for _, v in pes]
    med, p25, p75 = percentile(vals, 50), percentile(vals, 25), percentile(vals, 75)
    return {
        "value": round(e * med, 2), "low": round(e * p25, 2), "high": round(e * p75, 2),
        "inputs": {"ttm_eps": round(e, 2), "eps_to": end.isoformat(), "median_pe": round(med, 1), "pe_25": round(p25, 1),
                   "pe_75": round(p75, 1), "current_pe": round(price / e, 1), "weeks": len(vals),
                   "from": pes[0][0].isoformat(), "to": pes[-1][0].isoformat()},
        "formula": "TTM EPS × median P/E (range: 25th–75th percentile P/E)",
    }


def graham_number(eps: float, bvps: float) -> float | None:
    if eps <= 0 or bvps <= 0:
        return None
    return math.sqrt(GRAHAM_MULTIPLE * eps * bvps)


def graham_view(rows: Sequence[Row]) -> dict:
    note = GRAHAM_NOTE
    eps, bv = fin.ttm_eps(rows), fin.book_value_per_share(rows)
    if isinstance(eps, Missing):
        return {"missing": eps.reason, "note": note}
    if isinstance(bv, Missing):
        return {"missing": bv.reason, "note": note, "inputs": {"ttm_eps": round(eps[1], 2)}}
    inputs = {"ttm_eps": round(eps[1], 2), "eps_to": eps[0].isoformat(), "book_value_per_share": round(bv[1], 2), "book_value_at": bv[0].isoformat()}
    g = graham_number(eps[1], bv[1])
    if g is None:
        which = "EPS" if eps[1] <= 0 else "book value"
        return {"missing": f"{which} is zero or negative, so the Graham number isn't defined", "note": note, "inputs": inputs}
    return {"value": round(g, 2), "inputs": inputs, "formula": "√(22.5 × EPS × book value per share)", "note": note}


def dcf_value(fcf0: float, g: float, r: float, tg: float, years: int = DCF_YEARS) -> float:
    """Present value of free cash flow growing at g for `years`, then at tg for ever, at discount r."""
    if r <= tg:
        raise ValueError("discount rate must be above terminal growth")
    pv, f = 0.0, fcf0
    for t in range(1, years + 1):
        f *= 1 + g
        pv += f / (1 + r) ** t
    return pv + f * (1 + tg) / (r - tg) / (1 + r) ** years


def implied_growth(market_value: float, fcf0: float, r: float = DEFAULT_DISCOUNT, tg: float = DEFAULT_TERMINAL,
                   years: int = DCF_YEARS) -> float | Missing:
    """The g at which dcf_value equals market_value (bisection; value rises with g when fcf0 > 0)."""
    if fcf0 <= 0:
        return Missing("free cash flow is zero or negative, so no growth rate makes the sum work")
    if market_value <= 0:
        return Missing("no market value")
    if dcf_value(fcf0, GROWTH_HI, r, tg, years) < market_value:
        return Missing(f"the price implies more than {GROWTH_HI:.0%} a year for {years} years")
    if dcf_value(fcf0, GROWTH_LO, r, tg, years) > market_value:
        return Missing(f"the price implies cash flow shrinking more than {-GROWTH_LO:.0%} a year")
    lo, hi = GROWTH_LO, GROWTH_HI
    for _ in range(100):
        mid = (lo + hi) / 2
        if dcf_value(fcf0, mid, r, tg, years) < market_value:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def reverse_dcf_view(price: float, rows: Sequence[Row], financial: bool, r: float, tg: float) -> dict:
    settings = {"discount_rate": r, "terminal_growth": tg, "years": DCF_YEARS}
    if financial:
        return {"missing": "skipped for banks and financial companies: deposits and loans run through their cash flow", "inputs": settings}
    shares = fin.latest_shares(rows)
    fcf = fin.ttm_fcf(rows)
    if isinstance(fcf, Missing):
        return {"missing": fcf.reason, "inputs": settings}
    if not shares:
        return {"missing": "share count missing from the filings", "inputs": settings}
    end, f, how = fcf
    mv = price * shares
    inputs = {**settings, "fcf": round(f), "fcf_period": how, "fcf_to": end.isoformat(), "shares": round(shares), "market_value": round(mv)}
    g = implied_growth(mv, f, r, tg)
    if isinstance(g, Missing):
        return {"missing": g.reason, "inputs": inputs}
    return {"value": round(g, 4), "inputs": inputs,
            "formula": "The growth rate at which 10 years of free cash flow, plus what follows, discounted at the rate below, adds up to price × shares"}


def past_growth_view(rows: Sequence[Row]) -> dict:
    got = fin.past_growth(rows)
    if isinstance(got, Missing):
        return {"missing": got.reason}
    what, g, years = got
    return {"value": round(g, 4), "what": what, "years": years}


def is_financial(rows: Sequence[Row], sector: str | None) -> bool:
    return any(r.kind == "banking" for r in rows) or (sector or "") in FINANCIAL_SECTORS


def views(days: Sequence[StockDay], all_rows: Sequence[Row], sector: str | None,
          discount: float = DEFAULT_DISCOUNT, terminal: float = DEFAULT_TERMINAL) -> dict:
    """Everything the valuation panel shows for one stock."""
    rows = fin.pick_basis(all_rows)
    priced = [d for d in days if d.close and d.close > 0]
    if not rows:
        return {"missing": "no results filings stored for this company"}
    if not priced:
        return {"missing": "no NSE prices stored for this company"}
    last = max(priced, key=lambda d: d.date)
    financial = is_financial(rows, sector)
    return {
        "price": last.close, "price_date": last.date.isoformat(),
        "basis": "consolidated" if rows[0].consolidated else "standalone",
        "financial": financial,
        "pe": pe_view(last.close, priced, rows),
        "graham": graham_view(rows),
        "reverse_dcf": reverse_dcf_view(last.close, rows, financial, discount, terminal),
        "past_growth": past_growth_view(rows),
        "sources": [{"period_end": r.period_end.isoformat(), "url": r.source} for r in rows[-6:] if r.source],
    }
