"""Company names from Kite's instruments list (holdings only carry the trading symbol).

The NSE and BSE lists are a few MB of CSV, published once a day, so they're fetched at most every
12 hours per API instance and kept in memory. If the download fails, holdings still load and show
their symbols; names fill in on the next refresh.
"""

import csv
import io
import logging
import time

from app import kite

log = logging.getLogger(__name__)
_TTL = 12 * 3600
_cache: dict[str, str] = {}
_loaded_at = 0.0


def names(access_token: str) -> dict[str, str]:
    """{"NSE:TATAMOTORS": "TATA MOTORS", "INE155A01022": "TATA MOTORS", …}"""
    global _cache, _loaded_at
    if _cache and time.time() - _loaded_at < _TTL:
        return _cache
    fresh: dict[str, str] = {}
    for exchange in ("NSE", "BSE"):
        try:
            text = kite.get_text(access_token, f"/instruments/{exchange}")
        except Exception as e:  # noqa: BLE001 - names are a nicety, never a reason to fail a refresh
            log.warning("instruments %s unavailable: %s", exchange, e)
            continue
        for row in csv.DictReader(io.StringIO(text)):
            if row.get("instrument_type") != "EQ":
                continue
            name = (row.get("name") or "").strip()
            if name:
                fresh.setdefault(f"{exchange}:{row.get('tradingsymbol')}", name)
    if fresh:
        _cache, _loaded_at = fresh, time.time()
    return _cache


def clear() -> None:
    global _cache, _loaded_at
    _cache, _loaded_at = {}, 0.0
