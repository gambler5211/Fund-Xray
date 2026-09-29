"""Reading NSE's published files. Pure parsing, no network (the jobs/ scripts download).

- Daily index closes: nsearchives.nseindia.com/content/indices/ind_close_all_DDMMYYYY.csv
  one file per trading day with ~130 indices (open, high, low, close, P/E, P/B, dividend yield).
- Index constituents: nsearchives.nseindia.com/content/indices/ind_<index>_list.csv
  company, NSE industry (sector level: "Capital Goods", "Power", ...), symbol, series, ISIN.
"""

from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta
from typing import Iterator

ARCHIVE = "https://nsearchives.nseindia.com/content/indices"

# NSE's sector level of its industry classification, as used in the constituent files.
INDUSTRIES = (
    "Automobile and Auto Components", "Capital Goods", "Chemicals", "Construction", "Construction Materials",
    "Consumer Durables", "Consumer Services", "Diversified", "Fast Moving Consumer Goods", "Financial Services",
    "Forest Materials", "Healthcare", "Information Technology", "Media Entertainment & Publication",
    "Metals & Mining", "Oil Gas & Consumable Fuels", "Power", "Realty", "Services", "Telecommunication",
    "Textiles", "Utilities",
)


def close_all_url(d: date) -> str:
    return f"{ARCHIVE}/ind_close_all_{d:%d%m%Y}.csv"


def weekdays(start: date, end: date) -> Iterator[date]:
    """Every Monday–Friday from start to end inclusive. Market holidays simply have no file."""
    d = start
    while d <= end:
        if d.weekday() < 5:
            yield d
        d += timedelta(days=1)


def _num(v: str | None) -> float | None:
    v = (v or "").strip().replace(",", "")
    if v in ("", "-", "NA"):
        return None
    try:
        return float(v)
    except ValueError:
        return None


def norm(name: str) -> str:
    """Index names differ in case between files ("NIFTY Midcap 100" / "Nifty Midcap 100")."""
    return " ".join(name.lower().split())


def parse_close_all(text: str) -> list[dict]:
    """Rows of one ind_close_all file → [{name, date, open, high, low, close, pe, pb, div_yield}]."""
    out = []
    reader = csv.DictReader(io.StringIO(text.lstrip("﻿")))
    for r in reader:
        r = {(k or "").strip(): v for k, v in r.items()}
        name = (r.get("Index Name") or "").strip()
        close = _num(r.get("Closing Index Value"))
        raw_date = (r.get("Index Date") or "").strip()
        if not name or close is None or not raw_date:
            continue
        out.append({
            "name": name,
            "date": datetime.strptime(raw_date, "%d-%m-%Y").date().isoformat(),
            "open": _num(r.get("Open Index Value")),
            "high": _num(r.get("High Index Value")),
            "low": _num(r.get("Low Index Value")),
            "close": close,
            "pe": _num(r.get("P/E")),
            "pb": _num(r.get("P/B")),
            "div_yield": _num(r.get("Div Yield")),
        })
    return out


def parse_constituents(text: str) -> list[dict]:
    """ind_*_list.csv → [{isin, symbol, company_name, industry}]."""
    out = []
    for r in csv.DictReader(io.StringIO(text.lstrip("﻿"))):
        r = {(k or "").strip(): (v or "").strip() for k, v in r.items()}
        isin, symbol, industry = r.get("ISIN Code"), r.get("Symbol"), r.get("Industry")
        if isin and symbol and industry:
            out.append({"isin": isin, "symbol": symbol, "company_name": r.get("Company Name") or symbol, "industry": industry})
    return out


def sector_split(holdings: list[dict], sectors: dict[str, str | None]) -> list[dict]:
    """Group holdings by sector for "Where the money sits".

    `sectors` maps "EXCHANGE:SYMBOL" to an industry (None = unmapped). Returns sectors biggest
    first, each with its share of the portfolio and its holdings biggest first. Shares add to 100.
    """
    total = sum(h["value"] for h in holdings) or 0.0
    groups: dict[str, list[dict]] = {}
    for h in holdings:
        key = sectors.get(f"{h['exchange']}:{h['symbol']}") or "Unmapped"
        groups.setdefault(key, []).append(h)
    out = []
    for name, items in groups.items():
        value = sum(h["value"] for h in items)
        out.append({
            "sector": name,
            "value": round(value, 2),
            "share_pct": round(value / total * 100, 2) if total else 0.0,
            "holdings": [
                {"symbol": h["symbol"], "name": h["name"], "value": h["value"],
                 "share_pct": round(h["value"] / total * 100, 2) if total else 0.0}
                for h in sorted(items, key=lambda x: x["value"], reverse=True)
            ],
        })
    out.sort(key=lambda g: (g["sector"] == "Unmapped", -g["value"]))
    return out
