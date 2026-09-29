"""Fund X-Ray API.

Day 1: only /health, so the web app can show "API connected".
Later days add Google-token checks (Day 3), the Kite login flow (Day 4) and holdings (Day 5).
"""

from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
