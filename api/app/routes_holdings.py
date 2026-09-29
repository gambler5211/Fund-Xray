"""Holdings (Day 5): pull from Kite, work out the totals with the engine, save a snapshot.

POST /holdings/refresh   pull now (runs right after connecting, and on the Refresh button)
GET  /holdings           the latest saved snapshot, without calling Kite
"""

from fastapi import APIRouter, Depends
from fund_xray_engine import build_snapshot

from app import instruments, supa
from app.auth import User, current_user
from app.config import settings
from app.errors import problem
from app.outbound import client
from app.routes_kite import kite_get, live_token

router = APIRouter(prefix="/holdings", tags=["holdings"], dependencies=[Depends(current_user)])


@router.post("/refresh")
def refresh(user: User = Depends(current_user)) -> dict:
    token = live_token(user)
    holdings = kite_get(user, "/portfolio/holdings", token)
    positions = kite_get(user, "/portfolio/positions", token)
    names = instruments.names(token)
    snap = build_snapshot(holdings or [], positions or {}, names)
    saved = supa.rpc(user, "save_holdings_snapshot", {
        "p_holdings": snap["holdings"], "p_positions": snap["positions"], "p_totals": snap["totals"],
    }) or []
    taken_at = saved[0]["taken_at"] if saved else None
    return {"taken_at": taken_at, **snap}


@router.get("")
def latest(user: User = Depends(current_user)) -> dict:
    url = f"{settings.supabase_url.rstrip('/')}/rest/v1/holdings_snapshot"
    r = client().get(url, headers=supa._headers(user), params={
        "select": "taken_at,holdings,positions,totals", "order": "taken_at.desc", "limit": "1",
    })
    if r.status_code >= 400:
        raise problem(502, "database_error", f"The database refused the snapshot read ({r.status_code}).")
    rows = r.json()
    return rows[0] if rows else {"taken_at": None, "holdings": [], "positions": [], "totals": None}
