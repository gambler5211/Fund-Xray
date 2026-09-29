"""Kite Connect: the login link, swapping the one-time request token, and authenticated calls.

Docs: https://kite.trade/docs/connect/v3/user/
The API secret is used only here, only on the server, and never leaves this process.
"""

import hashlib
from datetime import datetime, time, timedelta, timezone
from urllib.parse import urlencode

import httpx

from app import outbound
from app.config import settings
from app.errors import not_configured, problem

IST = timezone(timedelta(hours=5, minutes=30))  # India has no daylight saving


class KiteTokenExpired(Exception):
    """Kite said the access token is no longer valid (TokenException)."""


def _require_key() -> str:
    if not settings.kite_api_key:
        raise not_configured("KITE_API_KEY")
    return settings.kite_api_key


def login_url(state: str) -> str:
    """Zerodha's own login page. Kite sends the browser back to the redirect URL registered on the
    Kite app, adding request_token, status, and our `state` (via redirect_params)."""
    params = {"v": "3", "api_key": _require_key(), "redirect_params": urlencode({"state": state})}
    return f"{settings.kite_login_url}?{urlencode(params)}"


def next_expiry(now: datetime | None = None) -> datetime:
    """Kite access tokens stop working at 6 AM IST the next morning (or this morning, if it's
    between midnight and 6 AM)."""
    now = (now or datetime.now(timezone.utc)).astimezone(IST)
    six = datetime.combine(now.date(), time(6, 0), tzinfo=IST)
    return six if now < six else six + timedelta(days=1)


def _raise_for(r: httpx.Response) -> None:
    if r.status_code < 400:
        return
    try:
        body = r.json()
    except ValueError:
        body = {}
    kind = body.get("error_type", "")
    if kind == "TokenException" or (r.status_code == 403 and not kind):
        raise KiteTokenExpired()
    if kind == "PermissionException":
        raise problem(403, "kite_permission", body.get("message") or "This Kite app isn't allowed to do that.")
    if r.status_code in (429,) or r.status_code >= 500 or kind in ("NetworkException", "DataException"):
        raise problem(503, "kite_down", "Kite isn't answering right now. Try again in a few minutes.")
    raise problem(400, "kite_error", body.get("message") or f"Kite refused the request ({r.status_code}).")


def _call(method: str, path: str, **kw) -> httpx.Response:
    try:
        r = outbound.client().request(method, f"{settings.kite_api_url}{path}", headers={"X-Kite-Version": "3", **kw.pop("headers", {})}, **kw)
    except httpx.HTTPError:
        raise problem(503, "kite_down", "Couldn't reach Kite. Try again in a few minutes.") from None
    _raise_for(r)
    return r


def exchange(request_token: str) -> dict:
    """Swap the one-time request token for an access token, using the API secret."""
    key = _require_key()
    if not settings.kite_api_secret:
        raise not_configured("KITE_API_SECRET")
    checksum = hashlib.sha256(f"{key}{request_token}{settings.kite_api_secret}".encode()).hexdigest()
    try:
        r = _call("POST", "/session/token", data={"api_key": key, "request_token": request_token, "checksum": checksum})
    except KiteTokenExpired:
        # On this endpoint a TokenException means the request token was already used or is stale.
        raise problem(400, "login_expired", "That Zerodha login had expired. Connect again.") from None
    return r.json()["data"]


def get(access_token: str, path: str) -> dict:
    """An authenticated GET, e.g. get(token, "/user/profile"). Raises KiteTokenExpired."""
    r = _call("GET", path, headers={"Authorization": f"token {_require_key()}:{access_token}"})
    return r.json()["data"]


def invalidate(access_token: str) -> None:
    """Log the token out at Kite. Best effort: a failure here doesn't block disconnecting."""
    try:
        _call("DELETE", "/session/token", params={"api_key": _require_key(), "access_token": access_token})
    except Exception:  # noqa: BLE001 - we're discarding the token either way
        pass
