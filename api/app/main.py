"""Fund X-Ray API.

Public:  /, /health
Signed in (Supabase token checked on every request): everything on `private`, starting with /me.
Kite (Day 4): /kite/login-url, /kite/session, /kite/status, /kite/profile. Holdings (Day 5): POST /holdings/refresh, GET /holdings.
"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import crypto
from app.auth import User, current_user
from app.config import settings
from app.routes_kite import router as kite_router
from app.routes_holdings import router as holdings_router

log = logging.getLogger("fund_xray")



@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Say clearly in the logs what's missing, instead of failing on the first Kite login."""
    problem = crypto.key_status()
    if problem:
        log.error("Kite tokens can't be stored: %s", problem)
    for name in ("kite_api_key", "kite_api_secret", "supabase_publishable_key"):
        if not getattr(settings, name):
            log.warning("%s is not set", name.upper())
    yield


app = FastAPI(title="Fund X-Ray API", version=settings.version, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.web_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/")
def root() -> dict:
    """Friendly landing response so the bare API address isn't a 404."""
    return {"name": "Fund X-Ray API", "health": "/health", "docs": "/docs"}


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "version": settings.version,
        "time": datetime.now(timezone.utc).isoformat(),
    }


# Every route on this router requires a valid Supabase sign-in token.
private = APIRouter(dependencies=[Depends(current_user)])


@private.get("/me")
def me(user: User = Depends(current_user)) -> dict:
    """Who the API thinks you are. The Settings page calls this to show "The API recognises you"."""
    return {"id": user.id, "email": user.email}


app.include_router(private)
app.include_router(kite_router)
app.include_router(holdings_router)

