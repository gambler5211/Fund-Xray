"""Fund X-Ray API.

Public:  /, /health
Signed in (Supabase token checked on every request): everything on `private`, starting with /me.
Later days add the Kite login flow (Day 4) and holdings (Day 5) to `private`.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import User, current_user
from app.config import settings

app = FastAPI(title="Fund X-Ray API", version=settings.version)

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
