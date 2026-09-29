"""Connect Kite (Day 4).

The browser never sees the API secret or the access token. The flow:
  1. Web → GET /kite/login-url?state=…   → Zerodha's login page URL (web redirects there)
  2. Zerodha → web /kite/callback?request_token=…&state=…   (web checks state against a cookie)
  3. Web → POST /kite/session {request_token}   → API swaps it for an access token with the
     secret, encrypts it and stores it through Supabase as the signed-in user.
  4. GET /kite/status, GET /kite/profile, DELETE /kite/session afterwards.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app import crypto, kite, supa
from app.auth import User, current_user
from app.errors import problem

router = APIRouter(prefix="/kite", tags=["kite"], dependencies=[Depends(current_user)])


class SessionIn(BaseModel):
    request_token: str = Field(min_length=6, max_length=128)


def _stored(user: User) -> dict | None:
    rows = supa.rpc(user, "get_kite_token") or []
    return rows[0] if rows else None


def _status(row: dict | None) -> dict:
    if not row:
        return {"state": "never"}
    expires = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
    live = expires > datetime.now(timezone.utc)
    return {
        "state": "connected" if live else "expired",
        "kite_user_id": row.get("kite_user_id"),
        "connected_at": row.get("updated_at"),
        "expires_at": expires.isoformat(),
    }


def _mark_expired(user: User, row: dict) -> None:
    """Kite rejected the token before 6 AM (logged out elsewhere, secret changed…): keep the row
    but end its life now, so every page shows Reconnect instead of failing."""
    supa.rpc(user, "save_kite_token", {
        "p_enc": row["access_token_enc"],
        "p_kite_user_id": row.get("kite_user_id"),
        "p_expires_at": datetime.now(timezone.utc).isoformat(),
    })


def live_token(user: User) -> str:
    """The decrypted access token for Kite calls, or a 409 kite_expired / kite_not_connected."""
    row = _stored(user)
    if not row:
        raise problem(409, "kite_not_connected", "Connect your Zerodha account first.")
    if _status(row)["state"] != "connected":
        raise problem(409, "kite_expired", "Your Zerodha connection expired. Reconnect to refresh.")
    token = crypto.decrypt(row["access_token_enc"])
    if token is None:  # encryption key was rotated since this was saved
        _mark_expired(user, row)
        raise problem(409, "kite_expired", "Your Zerodha connection needs renewing. Reconnect.")
    return token


def kite_get(user: User, path: str) -> dict:
    """GET from Kite for this user; turns an early token expiry into a clean 409."""
    token = live_token(user)
    try:
        return kite.get(token, path)
    except kite.KiteTokenExpired:
        row = _stored(user)
        if row:
            _mark_expired(user, row)
        raise problem(409, "kite_expired", "Zerodha ended this connection. Reconnect to refresh.") from None


@router.get("/login-url")
def login_url(state: str = Query(min_length=16, max_length=128)) -> dict:
    return {"url": kite.login_url(state)}


@router.post("/session")
def create_session(body: SessionIn, user: User = Depends(current_user)) -> dict:
    data = kite.exchange(body.request_token)
    expires = kite.next_expiry()
    supa.rpc(user, "save_kite_token", {
        "p_enc": crypto.encrypt(data["access_token"]),
        "p_kite_user_id": data.get("user_id"),
        "p_expires_at": expires.isoformat(),
    })
    return {
        "state": "connected",
        "kite_user_id": data.get("user_id"),
        "user_name": data.get("user_name"),
        "expires_at": expires.isoformat(),
    }


@router.get("/status")
def status(user: User = Depends(current_user)) -> dict:
    return _status(_stored(user))


@router.get("/profile")
def profile(user: User = Depends(current_user)) -> dict:
    p = kite_get(user, "/user/profile")
    return {"kite_user_id": p.get("user_id"), "user_name": p.get("user_name"), "broker": p.get("broker")}


@router.delete("/session")
def delete_session(user: User = Depends(current_user)) -> dict:
    row = _stored(user)
    if row:
        token = crypto.decrypt(row["access_token_enc"])
        if token:
            kite.invalidate(token)
        supa.rpc(user, "delete_kite_token")
    return {"state": "never"}
