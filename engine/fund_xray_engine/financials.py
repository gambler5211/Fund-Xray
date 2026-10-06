"""Company financials from NSE's results filings (Week 3, Day 5). Pure functions, no network.

Every listed company files its quarterly results with NSE as XBRL. Two feeds carry them:

    to Dec 2024    /api/corporates-financial-results   (the "old" results filings)
    from 2025      /api/integrated-filing-results      ("Integrated Filing - Financials")

Both use SEBI's in-capmkt taxonomy and the same context names, which matter more than the dates:

    OneD   the quarter itself
    FourD  the year to date (3, 6, 9 or 12 months; the old filings print the quarter's dates on it,
           so the length comes from the quarter-end month, not from the context)
    OneI   the balance sheet date (only in half-year and year-end filings)

What is read (values are full rupees; EPS in rupees per share):

    EPS (basic)          BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations, or the
                         banks' BasicEarningsPerShareAfterExtraordinaryItems
    shares               PaidUpValueOfEquityShareCapital / FaceValueOfEquityShareCapital
    owners' equity       EquityAttributableToOwnersOfParent (Equity when there is no minority line;
                         banks: Capital + ReservesAndSurplus)
    operating cash flow  CashFlowsFromUsedInOperatingActivities, year to date
    capex                purchases of property, plant and equipment plus intangible assets, year to date

Cash-flow statements and balance sheets come only with the half-year (September) and year-end
(March) results, so free cash flow and book value update twice a year.

Per-share figures are put on today's share count before use: TTM profit is rebuilt as the sum of
each quarter's EPS x that quarter's shares, then divided by the latest shares. A split or bonus
then doesn't halve or double anyone's EPS halfway through the year.
"""

from __future__ import annotations

import math
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Iterable, Sequence

EPS_TAGS = (
    "BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations",
    "BasicEarningsLossPerShareFromContinuingOperations",
    "BasicEarningsPerShareAfterExtraordinaryItems",  # banks
    "BasicEarningsPerShareBeforeExtraordinaryItems",  # banks
)
EQUITY_TAGS = ("EquityAttributableToOwnersOfParent", "Equity")
OCF_TAGS = ("CashFlowsFromUsedInOperatingActivities",)
CAPEX_TAGS = (
    "PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities",
    "PurchaseOfIntangibleAssetsClassifiedAsInvestingActivities",
)
REVENUE_TAGS = ("RevenueFromOperations", "Income", "TotalIncome")
PROFIT_TAGS = ("ProfitOrLossAttributableToOwnersOfParent", "ProfitLossForPeriod", "ProfitLossForThePeriod")

YTD_MONTHS = {6: 3, 9: 6, 12: 9, 3: 12}  # quarter-end month -> months since April (Indian financial year)


class FilingError(ValueError):
    """The file isn't a results filing this parser understands."""


@dataclass(frozen=True)
class Filing:
    """One results filing, as read from its XBRL."""

    period_end: date
    consolidated: bool
    kind: str  # 'indas' or 'banking'
    ytd_months: int | None
    eps_q: float | None
    eps_ytd: float | None
    shares: float | None
    equity: float | None  # owners' equity at period end, half-year and year-end filings only
    ocf_ytd: float | None
    capex_ytd: float | None
    revenue_q: float | None
    profit_q: float | None


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _num(text: str | None) -> float | None:
    if text is None:
        return None
    t = text.strip().replace(",", "")
    if not t:
        return None
    try:
        v = float(t)
    except ValueError:
        return None
    return v if math.isfinite(v) else None


def parse_filing(xml_text: str | bytes) -> Filing:
    """Read one results filing. Raises FilingError if the period or EPS can't be found."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        raise FilingError(f"not XML: {e}") from e

    plain: dict[str, dict] = {}  # context id -> {"start", "end", "instant"}, only contexts with no dimensions
    for c in root.iter():
        if _local(c.tag) != "context":
            continue
        if any(_local(x.tag) == "explicitMember" or _local(x.tag) == "typedMember" for x in c.iter()):
            continue
        p = {}
        for x in c.iter():
            n = _local(x.tag)
            if n in ("startDate", "endDate", "instant") and x.text:
                p[n] = x.text.strip()
        plain[c.get("id", "")] = p

    facts: dict[str, dict[str, str]] = {}  # tag -> {context id -> text}
    for e in root.iter():
        ctx = e.get("contextRef")
        if ctx is None or ctx not in plain:
            continue
        facts.setdefault(_local(e.tag), {})[ctx] = (e.text or "").strip()

    def text(tag: str) -> str | None:
        vals = facts.get(tag)
        return next(iter(vals.values())) if vals else None

    def first(tags: Sequence[str], ctx: str) -> float | None:
        for t in tags:
            v = _num(facts.get(t, {}).get(ctx))
            if v is not None:
                return v
        return None

    quarter_ctx = "OneD" if "OneD" in plain else _guess(plain, "quarter")
    ytd_ctx = "FourD" if "FourD" in plain else _guess(plain, "ytd")
    inst_ctx = "OneI" if "OneI" in plain else _guess(plain, "instant")

    end = text("DateOfEndOfReportingPeriod") or (plain.get(quarter_ctx or "", {}).get("endDate"))
    if not end:
        raise FilingError("no reporting period")
    try:
        period_end = date.fromisoformat(end[:10])
    except ValueError as e:
        raise FilingError(f"bad period end {end!r}") from e

    nature = (text("NatureOfReportStandaloneConsolidated") or "").lower()
    kind = "banking" if ("ReservesAndSurplus" in facts or "BasicEarningsPerShareAfterExtraordinaryItems" in facts) else "indas"

    eps_q = first(EPS_TAGS, quarter_ctx) if quarter_ctx else None
    eps_ytd = first(EPS_TAGS, ytd_ctx) if ytd_ctx else None
    if eps_q is None and eps_ytd is None:
        raise FilingError("no EPS in the filing")

    paid = first(("PaidUpValueOfEquityShareCapital",), quarter_ctx or "") or first(("PaidUpValueOfEquityShareCapital",), ytd_ctx or "")
    face = first(("FaceValueOfEquityShareCapital",), quarter_ctx or "") or first(("FaceValueOfEquityShareCapital",), ytd_ctx or "")
    shares = paid / face if paid and face and paid > 0 and face > 0 else None

    equity = None
    if inst_ctx:
        equity = first(EQUITY_TAGS, inst_ctx)
        if equity is None:
            cap, res = first(("Capital",), inst_ctx), first(("ReservesAndSurplus",), inst_ctx)
            equity = cap + res if cap is not None and res is not None else None

    ocf = first(OCF_TAGS, ytd_ctx) if ytd_ctx else None
    capex = None
    if ytd_ctx:
        parts = [_num(facts.get(t, {}).get(ytd_ctx)) for t in CAPEX_TAGS]
        if any(p is not None for p in parts):
            capex = sum(abs(p) for p in parts if p is not None)

    return Filing(
        period_end=period_end,
        consolidated=nature.startswith("consolidated"),
        kind=kind,
        ytd_months=YTD_MONTHS.get(period_end.month),
        eps_q=eps_q,
        eps_ytd=eps_ytd,
        shares=shares,
        equity=equity,
        ocf_ytd=ocf,
        capex_ytd=capex,
        revenue_q=first(REVENUE_TAGS, quarter_ctx) if quarter_ctx else None,
        profit_q=first(PROFIT_TAGS, quarter_ctx) if quarter_ctx else None,
    )


def _guess(plain: dict[str, dict], want: str) -> str | None:
    """Fallback when a filer used its own context names: pick by dates."""
    if want == "instant":
        inst = [(p["instant"], k) for k, p in plain.items() if "instant" in p]
        return max(inst)[1] if inst else None
    durs = [(p["endDate"], p["startDate"], k) for k, p in plain.items() if "startDate" in p and "endDate" in p]
    if not durs:
        return None
    end = max(d[0] for d in durs)
    at_end = [d for d in durs if d[0] == end]
    pick = max(at_end, key=lambda d: d[1]) if want == "quarter" else min(at_end, key=lambda d: d[1])
    return pick[2]


# ---------------------------------------------------------------------------------------------
# Series: what the valuation views need, from the stored rows of one company
# ---------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Row:
    """One stored row of company_financials (one company, one quarter, one basis)."""

    period_end: date
    consolidated: bool
    kind: str
    ytd_months: int | None
    eps_q: float | None
    eps_ytd: float | None
    shares: float | None
    equity: float | None
    ocf_ytd: float | None
    capex_ytd: float | None
    filed: date | None = None
    source: str | None = None


@dataclass(frozen=True)
class Missing:
    """Why a figure couldn't be worked out, in words for the screen."""

    reason: str


def _quarters_back(d: date, n: int) -> date:
    """The quarter end n quarters before d (d itself a quarter end)."""
    m = d.month - 3 * n
    y = d.year
    while m <= 0:
        m += 12
        y -= 1
    return _month_end(y, m)


def _month_end(y: int, m: int) -> date:
    nxt = date(y + (m == 12), m % 12 + 1, 1)
    return nxt - timedelta(days=1)


def pick_basis(rows: Sequence[Row]) -> list[Row]:
    """One series per company: consolidated when the latest quarter has it, else standalone.
    Mixing the two would add up figures that don't belong together."""
    if not rows:
        return []
    latest = max(r.period_end for r in rows)
    cons = any(r.consolidated and r.period_end == latest for r in rows)
    out = sorted((r for r in rows if r.consolidated == cons), key=lambda r: r.period_end)
    return out


def latest_shares(rows: Sequence[Row]) -> float | None:
    for r in sorted(rows, key=lambda r: r.period_end, reverse=True):
        if r.shares:
            return r.shares
    return None


def ttm_profit(rows: Sequence[Row], as_of: date | None = None) -> tuple[date, float] | Missing:
    """Trailing 12-month profit (rupees) from the last four consecutive quarters ending on or
    before `as_of`: the sum of each quarter's EPS x that quarter's shares."""
    by_end = {r.period_end: r for r in rows if r.eps_q is not None and r.shares}
    ends = sorted((d for d in by_end if as_of is None or d <= as_of), reverse=True)
    if not ends:
        return Missing("no quarterly EPS stored")
    last = ends[0]
    want = [_quarters_back(last, i) for i in range(4)]
    if any(w not in by_end for w in want):
        gap = next(w for w in want if w not in by_end)
        return Missing(f"quarter to {gap:%b %Y} is missing, so the last four quarters can't be added up")
    return last, sum(by_end[w].eps_q * by_end[w].shares for w in want)


def ttm_eps(rows: Sequence[Row], as_of: date | None = None) -> tuple[date, float] | Missing:
    """TTM EPS on today's share count."""
    shares = latest_shares(rows)
    if not shares:
        return Missing("share count missing from the filings")
    p = ttm_profit(rows, as_of)
    if isinstance(p, Missing):
        return p
    return p[0], p[1] / shares


def book_value_per_share(rows: Sequence[Row]) -> tuple[date, float] | Missing:
    """Owners' equity at the last half-year or year-end, on today's share count."""
    shares = latest_shares(rows)
    with_eq = [r for r in rows if r.equity is not None]
    if not with_eq:
        return Missing("no balance sheet stored yet (it comes with September and March results)")
    if not shares:
        return Missing("share count missing from the filings")
    r = max(with_eq, key=lambda r: r.period_end)
    return r.period_end, r.equity / shares


def annual_fcf(rows: Sequence[Row]) -> dict[date, float]:
    """Free cash flow (operating cash flow minus capex) for each full financial year stored."""
    return {r.period_end: r.ocf_ytd - r.capex_ytd for r in rows
            if r.ytd_months == 12 and r.ocf_ytd is not None and r.capex_ytd is not None}


def ttm_fcf(rows: Sequence[Row]) -> tuple[date, float, str] | Missing:
    """Trailing free cash flow and how it was built.

    After a year-end filing it is that year's figure. After a half-year filing it is last year's,
    minus last year's first half, plus this year's first half, when all three are stored;
    otherwise the last full year."""
    halves = {r.period_end: r.ocf_ytd - r.capex_ytd for r in rows
              if r.ytd_months == 6 and r.ocf_ytd is not None and r.capex_ytd is not None}
    years = annual_fcf(rows)
    if not years and not halves:
        if any(r.ocf_ytd is not None for r in rows):
            return Missing("capex isn't tagged in the filings, so free cash flow can't be worked out")
        return Missing("no cash-flow statement stored yet (it comes with September and March results)")
    last_year = max(years) if years else None
    last_half = max(halves) if halves else None
    if last_half and (last_year is None or last_half > last_year):
        prev_year = _quarters_back(last_half, 2)  # March before this September
        prev_half = _quarters_back(last_half, 4)
        if prev_year in years and prev_half in halves:
            return last_half, years[prev_year] - halves[prev_half] + halves[last_half], "trailing 12 months to " + f"{last_half:%b %Y}"
    if last_year is None:
        return Missing("only a half-year cash flow is stored; a full year is needed")
    return last_year, years[last_year], f"year to {last_year:%b %Y}"


def growth_rate(first: float, last: float, years: float) -> float | None:
    """Compound yearly growth from first to last, or None when either is zero or negative."""
    if years <= 0 or first <= 0 or last <= 0:
        return None
    return (last / first) ** (1 / years) - 1


def past_growth(rows: Sequence[Row]) -> tuple[str, float, int] | Missing:
    """How fast the company actually grew over the stored full years: free cash flow when both
    ends are positive, else EPS on today's share count. Returns (what, yearly rate, years)."""
    years = annual_fcf(rows)
    ends = sorted(years)
    if len(ends) >= 2:
        g = growth_rate(years[ends[0]], years[ends[-1]], (ends[-1] - ends[0]).days / 365.25)
        if g is not None:
            return "free cash flow", g, round((ends[-1] - ends[0]).days / 365.25)
    fy = sorted((r for r in rows if r.ytd_months == 12 and r.eps_ytd is not None and r.shares), key=lambda r: r.period_end)
    if len(fy) >= 2:
        a, b = fy[0], fy[-1]
        g = growth_rate(a.eps_ytd * a.shares, b.eps_ytd * b.shares, (b.period_end - a.period_end).days / 365.25)
        if g is not None:
            return "profit", g, round((b.period_end - a.period_end).days / 365.25)
    return Missing("fewer than two full years with positive figures")


def to_rows(items: Iterable[dict]) -> list[Row]:
    """Database rows (strings or numbers) to Row objects."""
    out = []
    for d in items:
        f = lambda k: None if d.get(k) is None else float(d[k])  # noqa: E731
        out.append(Row(
            period_end=date.fromisoformat(str(d["period_end"])[:10]),
            consolidated=bool(d["consolidated"]),
            kind=d.get("kind") or "indas",
            ytd_months=int(d["ytd_months"]) if d.get("ytd_months") is not None else None,
            eps_q=f("eps_q"), eps_ytd=f("eps_ytd"), shares=f("shares"), equity=f("equity"),
            ocf_ytd=f("ocf_ytd"), capex_ytd=f("capex_ytd"),
            filed=date.fromisoformat(str(d["filed_at"])[:10]) if d.get("filed_at") else None,
            source=d.get("source_url"),
        ))
    return out


# ---------------------------------------------------------------------------------------------
# Filing lists: NSE's two feeds read into one shape
# ---------------------------------------------------------------------------------------------

OLD_API = "/api/corporates-financial-results?index=equities&period=Quarterly&symbol={symbol}"
INTEGRATED_API = "/api/integrated-filing-results?index=equities&type=Integrated%20Filing-%20Financials&symbol={symbol}&page={page}&size={size}"


@dataclass(frozen=True)
class FilingRef:
    """Where one quarter's XBRL lives, from NSE's filing lists."""

    period_end: date
    consolidated: bool
    url: str
    filed: str | None  # ISO timestamp, IST
    revised: bool = False


def _nse_date(s: str | None) -> date | None:
    from datetime import datetime  # local: keeps the module's top imports to what the parser needs
    if not s:
        return None
    for fmt in ("%d-%b-%Y", "%d-%b-%Y %H:%M:%S", "%d-%b-%Y %H:%M"):
        try:
            return datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _nse_stamp(s: str | None) -> str | None:
    from datetime import datetime
    if not s:
        return None
    for fmt in ("%d-%b-%Y %H:%M:%S", "%d-%b-%Y %H:%M"):
        try:
            return datetime.strptime(s.strip(), fmt).isoformat() + "+05:30"
        except ValueError:
            continue
    return None


def _xml_url(u: object) -> str | None:
    return u if isinstance(u, str) and u.startswith("http") and u.lower().endswith(".xml") else None


def refs_from_old(items: Iterable[dict]) -> list[FilingRef]:
    """The older results list (to Dec 2024): quarterly, non-cumulative rows with an XBRL file."""
    out = []
    for x in items or []:
        url, end = _xml_url(x.get("xbrl")), _nse_date(x.get("toDate"))
        if not url or not end or (x.get("cumulative") or "").lower().startswith("cumulative"):
            continue
        out.append(FilingRef(end, (x.get("consolidated") or "").lower() == "consolidated", url, _nse_stamp(x.get("broadCastDate"))))
    return out


def refs_from_integrated(items: Iterable[dict]) -> list[FilingRef]:
    """The Integrated Filing (Financials) list, from 2025."""
    out = []
    for x in items or []:
        url, end = _xml_url(x.get("xbrl")), _nse_date(x.get("qe_Date"))
        if not url or not end:
            continue
        out.append(FilingRef(end, (x.get("consolidated") or "").lower() == "consolidated", url,
                             _nse_stamp(x.get("broadcast_Date")), (x.get("type_Sub") or "").lower().startswith("revis")))
    return out


def choose_refs(refs: Iterable[FilingRef], since: date) -> list[FilingRef]:
    """One filing per quarter from `since`, on one basis: consolidated when the company files it
    for its latest quarter, else standalone. A revised filing, or the later of two, wins."""
    refs = [r for r in refs if r.period_end >= since]
    if not refs:
        return []
    latest = max(r.period_end for r in refs)
    cons = any(r.consolidated and r.period_end == latest for r in refs)
    best: dict[date, FilingRef] = {}
    for r in refs:
        if r.consolidated != cons:
            continue
        cur = best.get(r.period_end)
        if cur is None or (r.revised, r.filed or "") > (cur.revised, cur.filed or ""):
            best[r.period_end] = r
    return [best[d] for d in sorted(best)]


def history_start(today: date) -> date:
    """First quarter end to import: enough for three full April-March years of growth, plus the
    quarters before the first year so a trailing-12-month EPS exists from the start of the price
    history. On 6 Oct 2026 that is 31 Dec 2022."""
    last_fy_end = today.year if today.month >= 4 else today.year - 1  # the last March that has passed
    return date(last_fy_end - 4, 12, 31)
