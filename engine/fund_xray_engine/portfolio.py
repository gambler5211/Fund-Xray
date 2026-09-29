"""Holdings snapshot: turns what Kite returns into the numbers every page shows.

Pure calculation, no network: the API fetches from Kite and hands the raw lists in. Money is
worked out with Decimal and rounded to paise only at the end, so totals match Kite Console to the
rupee instead of drifting by float error across ~60 rows.

Nothing here is a fixed list of stocks: whatever Kite returns today is the portfolio. Exits drop
out, new buys appear.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Iterable, Mapping

PAISE = Decimal("0.01")
ZERO = Decimal(0)


def _d(v: Any) -> Decimal:
    if v is None or v == "":
        return ZERO
    return Decimal(str(v))


def _money(x: Decimal) -> float:
    return float(x.quantize(PAISE, rounding=ROUND_HALF_UP))


def _pct(part: Decimal, whole: Decimal) -> float:
    if whole == 0:
        return 0.0
    return float((part / whole * 100).quantize(PAISE, rounding=ROUND_HALF_UP))


def company_name(raw: str | None, symbol: str) -> str:
    """Kite's instrument names are upper case ("TATA MOTORS"); make them readable
    ("Tata Motors") while keeping abbreviations ("HDFC Bank", "KPI Green Energy")."""
    if not raw:
        return symbol
    out = []
    for w in raw.split():
        core = w.strip(".,()-")
        if core.upper() in _ACRONYMS or "&" in core or any(ch.isdigit() for ch in core):
            out.append(w)
        elif len(core) <= 2 and core.upper() not in _SMALL_WORDS:
            out.append(w.upper())
        else:
            out.append(w.capitalize() if w.isupper() else w)
    return " ".join(out)


_SMALL_WORDS = {"OF", "AN", "IN", "TO", "ON", "BY", "AT"}
_ACRONYMS = {
    "HDFC", "ICICI", "SBI", "IDFC", "LIC", "ITC", "NTPC", "ONGC", "BHEL", "GAIL", "IRCTC", "IRFC", "NHPC", "SJVN",
    "RVNL", "BPCL", "HPCL", "IOC", "NMDC", "KPI", "KEI", "PNB", "IDBI", "BSE", "MCX", "CDSL", "NLC", "HUDCO", "IREDA",
    "ACC", "ABB", "BEL", "BEML", "HAL", "MRF", "TVS", "UPL", "DLF", "PVR", "GMR", "JSW", "IIFL", "KPIT", "NCC", "RBL",
    "TCS", "HCL", "UTI", "IFCI", "ESAF", "MSTC", "RITES", "IRCON", "NBCC", "SKF", "CESC", "GIC", "NIIT", "PTC", "REC",
    "SRF", "TTK", "VIP", "IFB", "HFCL", "HEG", "GNFC", "GSFC", "RCF", "NFL", "MMTC", "KIOCL", "SAIL", "CAMS", "KFIN",
    "NSDL", "ETF", "REIT", "INVIT", "IT", "PSU", "CPSE", "BEES", "SME", "MTAR", "CMS", "PCBL", "EPL", "JK", "RPG",
}


@dataclass
class Holding:
    symbol: str
    exchange: str
    isin: str | None
    name: str
    quantity: int
    t1_quantity: int
    pledged_quantity: int
    avg_price: float
    last_price: float
    close_price: float
    invested: float
    value: float
    day_change: float
    day_change_pct: float
    pnl: float
    pnl_pct: float
    weight_pct: float = 0.0
    notes: list[str] = field(default_factory=list)


@dataclass
class Position:
    symbol: str
    exchange: str
    product: str
    quantity: int
    avg_price: float
    last_price: float
    pnl: float


@dataclass
class Totals:
    invested: float
    value: float
    pnl: float
    pnl_pct: float
    day_change: float
    day_change_pct: float
    holdings_count: int
    positions_count: int
    positions_pnl: float


def build_snapshot(
    holdings: Iterable[Mapping[str, Any]],
    positions: Mapping[str, Any] | Iterable[Mapping[str, Any]] | None = None,
    names: Mapping[str, str] | None = None,
) -> dict:
    """Kite /portfolio/holdings and /portfolio/positions → {holdings, positions, totals}.

    Quantity counts settled shares plus T1 shares (bought yesterday, not yet delivered), as Kite
    Console does. Shares bought today live in positions until tomorrow and are not in the totals.
    `names` maps "EXCHANGE:SYMBOL" (or ISIN) to Kite's instrument name.
    """
    names = names or {}
    rows: list[tuple[Holding, Decimal]] = []
    tot_invested = tot_value = tot_prev = ZERO

    for h in holdings:
        qty = int(h.get("quantity") or 0) + int(h.get("t1_quantity") or 0)
        if qty <= 0:
            continue
        symbol = str(h.get("tradingsymbol") or "").strip()
        exchange = str(h.get("exchange") or "NSE")
        avg, last, close = _d(h.get("average_price")), _d(h.get("last_price")), _d(h.get("close_price"))
        q = Decimal(qty)
        invested, value = avg * q, last * q
        prev = close * q if close > 0 else value  # no previous close (e.g. listed today): no day change
        pledged = int(h.get("collateral_quantity") or 0)
        t1 = int(h.get("t1_quantity") or 0)
        notes = []
        if t1:
            notes.append(f"{t1} in T1")
        if pledged:
            notes.append(f"{pledged} pledged")
        raw_name = names.get(f"{exchange}:{symbol}") or names.get(str(h.get("isin") or ""))
        rows.append((Holding(
            symbol=symbol, exchange=exchange, isin=h.get("isin"), name=company_name(raw_name, symbol),
            quantity=qty, t1_quantity=t1, pledged_quantity=pledged,
            avg_price=_money(avg), last_price=_money(last), close_price=_money(close),
            invested=_money(invested), value=_money(value),
            day_change=_money(value - prev), day_change_pct=_pct(value - prev, prev),
            pnl=_money(value - invested), pnl_pct=_pct(value - invested, invested), notes=notes,
        ), value))
        tot_invested += invested
        tot_value += value
        tot_prev += prev

    out_holdings = []
    for row, value in sorted(rows, key=lambda r: r[1], reverse=True):
        row.weight_pct = _pct(value, tot_value)
        out_holdings.append(asdict(row))

    net = positions.get("net", []) if isinstance(positions, Mapping) else list(positions or [])
    out_positions = [
        asdict(Position(
            symbol=str(p.get("tradingsymbol")), exchange=str(p.get("exchange") or ""), product=str(p.get("product") or ""),
            quantity=int(p.get("quantity") or 0), avg_price=_money(_d(p.get("average_price"))),
            last_price=_money(_d(p.get("last_price"))), pnl=_money(_d(p.get("pnl"))),
        ))
        for p in net
        if int(p.get("quantity") or 0) != 0 or _d(p.get("pnl")) != 0
    ]

    totals = Totals(
        invested=_money(tot_invested), value=_money(tot_value),
        pnl=_money(tot_value - tot_invested), pnl_pct=_pct(tot_value - tot_invested, tot_invested),
        day_change=_money(tot_value - tot_prev), day_change_pct=_pct(tot_value - tot_prev, tot_prev),
        holdings_count=len(out_holdings), positions_count=len(out_positions),
        positions_pnl=_money(sum((_d(p["pnl"]) for p in out_positions), ZERO)),
    )
    return {"holdings": out_holdings, "positions": out_positions, "totals": asdict(totals)}
